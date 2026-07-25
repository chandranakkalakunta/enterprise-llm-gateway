# Enterprise LLM Gateway — Architecture

> **Status:** Architecture phase  
> **Last updated:** 2026-07-25  
> **Scope:** This document is the living architecture reference for the dedicated Enterprise LLM Gateway repository. Sections will grow component by component.


---

## 1. System Context & Trust Boundaries

The Enterprise LLM Gateway is a **customer-controlled control plane** between enterprise AI clients and every model destination the organisation allows:

| Actor / System | Role |
|----------------|------|
| Normal AI User | Follows corporate policy |
| Super AI User | May override within allowlisted limits (audited) |
| Corporate Admin | Defines purpose maps, DLP rules, and routing policy |
| Enterprise IdP | SSO / OIDC / SAML — identity and group → role |
| Public LLM providers | Claude, Grok, Gemini, OpenAI, … (controlled egress only) |
| Internal / customer-hosted LLMs | First-class peers to public models |
| Internal RAG engine | First-class destination for internal knowledge |
| Observability / SIEM | Metrics, logs, traces, alerts |

**Trust boundary (preferred deployment):** the gateway, policy store, semantic cache, conversation memory stores, internal LLMs, and internal RAG sit **inside the corporate firewall / private VPC**. Public providers are reached only via controlled egress when policy allows.

**Design principles for the boundary:**

- Gateway is the **source of truth** for policy (clients may hint purpose; they do not decide route).
- **Fail-closed** for external egress on DLP / policy failure.
- Private VPC / corporate firewall first; dedicated private cloud acceptable; pure multi-tenant public SaaS is not the primary offer.
- Thin synchronous data plane; metering, audit, and non-critical writes go async where safe.

---

## 2. Component Map

Nine core components make up the control and data planes:

| # | Component | Responsibility |
|---|-----------|----------------|
| 1 | **API Gateway / Proxy (data plane)** | Accept client requests (OpenAI-compatible and/or native), authn, stream proxying. Must stay thin on the hot path. |
| 2 | **Policy Engine** | Purpose → route maps, role checks, Super-user allowlists, budgets, feature flags. OPA + versioned config; fail-closed for egress. See §4. |
| 3 | **DLP / Input Guardrail Service** | Detect secrets, PII, regulated patterns, custom IP markers; redact or block before external call. Profile-driven. See §5. |
| 4 | **Semantic Cache** | Embedding + similarity lookup; store eligible request/response pairs under ACL / purpose scope. Bypass on failure. |
| 5 | **Routing Engine** | Ordered models per purpose; short capped retries; circuit breakers; quotas. See §6. |
| 6 | **Conversation Memory** | Multi-turn context per user and conversation; hybrid hot/durable storage; attachment handling; summarisation. See §3. |
| 7 | **Metering & Analytics** | Tokens, cost estimates, purpose, route, latency, cache outcomes; optional 1–5 star feedback as quality signals. Privacy-respecting defaults. |
| 8 | **Audit Log** | Immutable-style record of decisions, overrides, blocks, admin changes. SIEM export. |
| 9 | **Admin API / Console** | CRUD for purposes, maps, roles, DLP rules, cache and memory policy. SSO-protected. |

**Supporting (not counted above):** **Provider Adapters** (common interface; normalise vendor quirks — see §7) and Config & Secrets (policy versions, provider keys, RAG endpoints via customer secret manager).

```text
Clients (IDE / Chat / Apps / Agents / Batch)
        │
        ▼
┌───────────────────────────────────────────────┐
│           Customer VPC / Private deploy         │
│  API Gateway → Policy → DLP → Cache → Route     │
│       │              │                          │
│  Conversation     Metering + Audit              │
│     Memory        Admin Console                 │
└───────────┬───────────────┬───────────────────┘
            │               │
     Public LLMs     Internal LLMs / RAG
   (controlled egress)
```

Further detail for each component will be expanded in dedicated subsections and ADRs as decisions lock.

---

## 3. Conversation Memory (Locked Decisions)

> These decisions are **locked** for the initial architecture. Changes require a new ADR that supersedes [ADR-001](adr/001-conversation-memory-storage.md).

### 3.1 Unit of memory

- The **conversation (thread)** is the unit of memory.
- Every turn is scoped by **`user_id` + `conversation_id`**.
- No cross-user or cross-conversation context mixing — ever.

### 3.2 Hybrid storage

| Tier | Technology | Role |
|------|------------|------|
| **Hot** | Redis | Active conversation working set; low-latency read/write for multi-turn context assembly |
| **Durable** | Managed PostgreSQL | Authoritative history, metadata, retention, recovery after Redis eviction or restart |
| **Attachments** | Object storage | Files, images, and other binary payloads referenced from turns (not embedded in Redis/Postgres rows) |

### 3.3 Smart summarisation

- Older turns are **summarised** so active context stays within model window budgets without dropping the whole thread.
- Summaries remain bound to the same `user_id` + `conversation_id` isolation keys.
- Exact retention of full turns vs summary-only is policy-configurable; defaults favour privacy and cost control.

### 3.4 Strict isolation

- Isolation key: **`user_id` + `conversation_id`** on every read and write path.
- No shared caches or keys that could leak turns across users or threads.
- Agents and service accounts use the same isolation model (their own identity + conversation ids).

### 3.5 Noise reduction from day one

- Prefer structured, high-signal storage over dumping entire raw streams into memory by default.
- Tool noise, system chatter, and redundant retries should not pollute the durable thread without deliberate retention.
- Aligns with privacy-respecting metering: conversation memory is for **user experience and correct multi-turn routing**, not free-form surveillance.

### 3.6 Implications for the request path

1. Resolve identity → load or create conversation under isolation keys.
2. Assemble context from Redis (hot); fall back to Postgres + rehydrate Redis as needed.
3. Attach object-storage references for multimodal / file turns.
4. Apply policy, DLP, cache, and route as usual.
5. Persist new turns (and trigger summarisation when thresholds hit) off the critical streaming path where possible.

See **[ADR-001: Conversation Memory Storage](adr/001-conversation-memory-storage.md)** for the decision record.

---

## 4. Policy Engine

> These decisions are **locked** for the initial architecture. Changes require a new ADR that supersedes [ADR-002](adr/002-policy-engine.md).

### 4.1 Responsibility

The Policy Engine is the **authoritative decision point** for:

- Purpose → allowed destination / model bindings (and fallbacks)
- Role checks (Normal AI User vs Super AI User vs service principals / agents)
- Quotas, budgets, feature flags, and Super-user **allowlisted** overrides
- Whether **external egress** is permitted for this request

It does **not** own DLP scanning, semantic cache storage, or conversation memory — those components consume policy *outputs* (purpose, ACL scope, allow/deny, route set). The data-plane proxy stays thin: gather attributes → evaluate policy → enforce.

### 4.2 Key locked decisions

| Decision | Choice |
|----------|--------|
| Technology | **Open Policy Agent (OPA)** with Rego policies |
| Purpose UX | **Optional** — never forced on the user |
| Missing purpose | **Auto-classify** with a **small/fast LLM** against the admin catalogue |
| Purpose catalogue | Pre-populated; admins can **create / modify / delete** |
| Mandatory fallback | Built-in purpose **`General`** (always present; not deletable) |
| External egress | **Fail-closed** on deny or evaluation failure |
| Configuration | **Data-driven and versioned**; publish immutable policy snapshots; admin changes audited |
| Roles | Normal users follow policy; Super AI Users may override **within allowlists** (audited) |
| UX bar | Equal or better than native Claude / Grok / ChatGPT (type and go) |

### 4.3 High-level evaluation flow

```text
Request arrives (authn already done)
        │
        ▼
┌───────────────────────┐
│ Purpose present &     │──yes──► Use client/declared purpose
│ valid for principal?  │         (still subject to OPA)
└───────────┬───────────┘
            │ no
            ▼
┌───────────────────────┐
│ Small/fast LLM        │──► Map to catalogue purpose
│ auto-classify         │    or fall back to "General"
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ OPA (Rego) evaluate   │  inputs: principal, role, purpose,
│ policy snapshot       │  requested model/route, quotas,
│                       │  override flags, egress intent
└───────────┬───────────┘
            │
     allow + route set          deny / error
            │                        │
            ▼                        ▼
   Continue to DLP /            Fail-closed for
   cache / route                external egress
            │
            ▼
   Emit decision id, policy version,
   purpose source, override flags → Audit / Metering
```

**Purpose provenance** is always recorded as one of: `client` | `classifier` | `default_general` (and later variants if needed). That keeps analytics honest when measuring “did policy or the model pick the path?”

**Latency posture:** classification and OPA evaluation sit on the path to first route selection. Prefer a small/fast classifier, short timeouts, optional short-TTL classification cache keyed by conversation/context hash, and compiled/local policy snapshots so OPA is an in-process or sidecar call — not a remote round-trip on every token.

### 4.4 Purpose for Normal users vs Super AI Users / Agents

| Principal | How purpose works | Override |
|-----------|-------------------|----------|
| **Normal AI User** | Optional client purpose; else classifier; else **`General`**. Bound only to destinations allowed for that purpose and role. | No free-form model shopping outside policy. |
| **Super AI User** | Same purpose resolution by default. May request an override (model / destination) **only if** it appears on an admin-defined allowlist for that principal or group. | Overrides are **audited** (who, what, purpose, policy version). Out-of-allowlist requests are denied. |
| **Agents / service accounts** | Same isolation and purpose model as human principals (their own identity + conversation ids). Purpose may be declared by the calling app when known (e.g. `internal_knowledge`); otherwise classifier / `General`. | Only if the service principal is granted Super-class allowlists; least privilege by default. |

**Admin-managed purposes:** the platform ships with a sensible pre-populated set (e.g. coding, realtime, image, internal knowledge, general). Admins add, rename, rebind routes, or retire purposes through the Admin API / Console. **`General` is mandatory** — it is the safety net when classification is uncertain and the default home for broad, low-specificity work. Deleting `General` is not allowed.

**UX principle:** the gateway must not feel like a bureaucracy layer. Most users never pick a purpose; they chat as they would in a native product. Policy still runs every time.

### 4.5 Policy data and versioning

- Policy **data** (purpose catalogue, route bindings, role maps, allowlists, quotas) is stored under admin control and published as **versioned snapshots**.
- The data plane evaluates against a **pinned snapshot** (not “latest mutable row mid-request”).
- Publish path: draft → validate (Rego tests / dry-run) → publish → replicas load snapshot → audit event.
- Fail-closed: if the active snapshot cannot be loaded or OPA errors on an egress decision, **do not** call public providers.

See **[ADR-002: Policy Engine (OPA)](adr/002-policy-engine.md)** for the decision record.

---

## 5. Input Guardrails / DLP

> These decisions are **locked** for the initial architecture. Changes require a new ADR that supersedes [ADR-003](adr/003-input-guardrails-dlp.md).

### 5.1 Responsibility

The Input Guardrails / DLP service inspects **user-supplied text** before a request is allowed to leave the trust boundary (and, under profile policy, before some internal routes as well). It:

- Detects secrets, PII, regulated patterns, and **custom corporate markers**
- Applies an action: **allow**, **redact**, or **hard block**
- Returns a scan result (hits, redacted text, action, rule ids) to the data plane for routing and audit
- Does **not** decide purpose or destination — that remains the Policy Engine’s job

Detection runs **entirely inside the trust boundary**. It must never call a public LLM to “check” whether content is sensitive.

### 5.2 Key locked decisions

| Decision | Choice |
|----------|--------|
| v1 detection | **Regex + pattern libraries + basic ML/NER classifiers** |
| Public LLM for DLP | **Not allowed** |
| Default action | **Redact** matched spans and **continue** |
| High-sensitivity | **Hard Block** when the active profile requires it (e.g. active patents, internal-only document markers) |
| Custom patterns | First-class; **admin-manageable** (data-driven) |
| v1 scope | **Text prompts only**; file/image scanning deferred (critical follow-on) |
| Evaluation failure | **Fail-closed** for external destinations → **Block** egress |
| Configuration | Rules, patterns, and **profiles** are data-driven; no code deploy to add a pattern |
| Policy input | Receives **`dlp_profile`** (or equivalent) from the Policy Engine |

### 5.3 High-level processing flow

```text
Policy Engine allow + route set + dlp_profile
        │
        ▼
┌───────────────────────────┐
│ Load profile snapshot     │  patterns, NER toggles,
│ (versioned, data-driven)  │  category → action map
└─────────────┬─────────────┘
              ▼
┌───────────────────────────┐
│ Scan text prompt          │  Regex / pattern packs
│ (v1: text only)           │  + basic ML/NER
└─────────────┬─────────────┘
              │
     no hits / below threshold
              │──────────────► Allow (unmodified)
              │
     hits found
              ▼
┌───────────────────────────┐
│ Resolve action per hit    │  profile category policy
│ and overall request       │  redact vs block
└─────────────┬─────────────┘
              │
     any Block category?          Redact-only hits
              │                        │
              ▼                        ▼
         Hard Block              Apply redactions
         (no external call)      (placeholders)
              │                        │
              │                        ▼
              │               Continue to cache / route
              │               with redacted text
              ▼
         User-facing denial
         (no sensitive detail leaked)
              │
              ▼
    Emit scan id, profile version, hit categories,
    action → Audit / Metering (metadata, not raw secrets)
```

**Latency posture:** keep scans synchronous but bounded (compiled regex, local NER, no remote DLP-as-a-service on the hot path unless it is in-VPC and SLO-bound). Prefer streaming-friendly design: scan the assembled user turn before first external byte is sent.

### 5.4 Relationship with the Policy Engine

| From Policy Engine | Used by DLP for |
|--------------------|-----------------|
| **`dlp_profile`** | Which pattern packs, NER features, and category→action map apply |
| Egress intent / destination type | Fail-closed path: errors on **external** routes → Block |
| Purpose / principal (optional attributes) | Audit correlation; optional profile variants by purpose |

Flow order on the request path:

1. Authn → purpose resolution → **OPA policy** (allow/deny, route set, **`dlp_profile`**)
2. **DLP scan** under that profile
3. Semantic cache / route with **redacted** (or original) text only if DLP allows continuation

DLP does not re-run OPA. If redaction changes the text, downstream components (cache keys, provider payload) use the **post-DLP** text. Cache scoping must account for profile and policy version so redacted and unredacted variants do not cross-contaminate.

### 5.5 Redact vs Block

| Mode | Behaviour | Typical use |
|------|-----------|-------------|
| **Redact (default)** | Replace spans with stable placeholders (e.g. `[REDACTED:API_KEY]`); request continues | API keys, emails, phone numbers, common secrets developers paste by mistake |
| **Hard Block** | Stop the request; no external provider call; clear user message without echoing the secret | Active patents, explicit internal-only document markers, categories the profile marks as non-negotiable |
| **Allow** | No qualifying hits | Clean text |

Principles:

- Prefer **redact-and-continue** so the product still feels like native chat for recoverable mistakes.
- **Block** remains mandatory for high-sensitivity profiles/categories — security is not only soft redaction.
- Failures (timeout, scanner crash, missing profile) on a path that would call a **public** destination → **Block** (fail-closed), consistent with ADR-002 egress posture.

### 5.6 Custom patterns

Admins manage corporate-specific detectors without code changes:

- Pattern definitions (regex / dictionary / structured detectors) and metadata (category, default action, severity)
- Packs and **profiles** that bind categories to redact vs block
- Versioned publish (draft → validate → publish), same operational spirit as policy snapshots
- Examples: product codenames, active patent identifiers, internal project keys, regulated account formats unique to the enterprise

Built-in libraries cover common secrets and PII; **custom packs are first-class**, not a bolt-on afterthought.

### 5.7 v1 scope and future file / image scanning

| Scope | v1 | Later |
|-------|----|--------|
| Chat / API **text** prompts | In scope | — |
| File uploads (PDF, Office, source archives) | Deferred | Extract text / structured scan under same profiles |
| Images / screenshots | Deferred | OCR + optional vision classifiers **in-boundary only** |
| Multimodal provider payloads | Text parts only | Full attachment pipeline |

File and image scanning is **acknowledged as critical** for real enterprise adoption (users will attach decks and screenshots). It is phased so the text action model, profiles, and admin APIs ship first without claiming multimodal coverage prematurely.

See **[ADR-003: Input Guardrails / DLP](adr/003-input-guardrails-dlp.md)** for the decision record.

---

## 6. Routing Engine

> These decisions are **locked** for the initial architecture. Changes require a new ADR that supersedes [ADR-004](adr/004-routing-and-adapters.md).

### 6.1 Responsibility

The Routing Engine turns a policy-allowed request into a concrete **destination attempt sequence**, then drives execution through Provider Adapters until success or exhaustion. It owns:

- Building the **ordered candidate list** of models for the resolved purpose
- **Short, capped retries** on the current model, then advance to the next
- **Circuit breaking** for persistently unhealthy models / providers
- **Rate limits and quotas** enforcement (per user, per agent, per purpose) before and during attempts
- Fallback to **`General`** purpose models when the purpose list is empty or fully exhausted
- Emitting routing outcome metadata for metering, audit, and the client (which model answered)

It does **not** invent policy (OPA does), scan content (DLP does), or speak vendor wire protocols (adapters do).

### 6.2 Key locked decisions

| Decision | Choice |
|----------|--------|
| Preference model | Admin-defined **ordered list of models per purpose** |
| Exhausted / no match | Fall back to models bound to **`General`** |
| Retries | Short **capped exponential** backoff on current model, then next (e.g. ~200 ms → 500 ms → 1 s; total extra delay budget ~**1.5–2 s**) |
| Health | **Circuit breaking** for persistently unhealthy models |
| Attribution | Every response must show **model + sub-model** that generated it |
| Agents | First-class **high-risk** consumers — stronger rate limits and controls |
| Abuse controls | Admin quotas/limits per **user**, **agent**, and **purpose**; throttle or hard-block abuse |
| Discovery | Periodic background sync + manual refresh for Super AI Users (feeds the catalogue routing uses) |

### 6.3 Selection, retry, and fallback flow

```text
Policy allow + purpose + principal + optional Super-user override
        │
        ▼
┌────────────────────────────┐
│ Enforce rate limits /      │──over limit──► Throttle or hard-block
│ quotas (user|agent|purpose)│                (no provider call)
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ Build ordered candidates   │  purpose model list
│ (skip open circuits)       │  → else General list
└─────────────┬──────────────┘
              ▼
        For each candidate model:
              │
              ▼
┌────────────────────────────┐
│ Adapter.invoke (stream)    │
│ transient fail?            │
└─────────────┬──────────────┘
              │
     retry with short backoff     success
     (capped; ~1.5–2s budget) ──────────► Stream + attribute model
              │                              + sub-model; close circuit soft
              ▼
     retries exhausted → next candidate
              │
              ▼
     all candidates failed ──► Gateway error; open/record circuits
```

**Super AI User overrides:** if Policy allows an override, that model is tried **first** (or exclusively if policy says so), still subject to circuit state, quotas, and DLP. Out-of-allowlist overrides never reach the Routing Engine.

**Latency posture:** prefer failing over to the next healthy model over waiting many seconds on a dead one. The ~1.5–2 s extra delay budget is a **ceiling for retries on a single model**, not permission to stack long waits across the whole list without product review.

### 6.4 Circuit breaking

- Track success/failure (and optionally latency) **per model** (and optionally per provider endpoint).
- **Open** circuit after sustained failure → skip that model in candidate building.
- **Half-open** probe after cooldown; success closes circuit, failure re-opens.
- Circuit state is shared across data-plane replicas (or consistently sharded) so one replica does not keep hammering a bad model.
- Circuit open is **not** a substitute for admin removing a model from the ordered list; it is runtime protection.

### 6.5 Rate limiting, quotas, and Agents

| Principal | Controls |
|-----------|----------|
| **Normal AI User** | Per-user and per-purpose rate limits / token quotas as configured by admin |
| **Super AI User** | Same base controls; overrides do not bypass quota unless admin explicitly grants a higher envelope |
| **Agents / service accounts** | **Stricter defaults**: lower burst, lower sustained RPS, tighter token budgets; treat as high-risk automation |

Admins can:

- Set limits **per user**, **per agent**, and **per purpose**
- **Throttle** (slow / 429 with retry-after) or **hard-block** abusive behaviour
- Observe limit hits in metering without logging raw prompts by default

Agents are **first-class** Gateway consumers (F17) but must not be able to starve interactive human traffic or silently rack up cost.

### 6.6 Relationship to Policy and DLP

| Upstream | Routing uses it for |
|----------|---------------------|
| Purpose (+ provenance) | Which ordered model list to load; `General` fallback |
| Allow / deny + egress | Whether external models may appear at all |
| Super-user allowlist decision | Optional override candidate |
| Post-DLP text | Payload passed to adapters (never pre-DLP secrets that were redacted) |

Order on the path: **Policy → DLP → (optional Semantic Cache) → Routing → Adapter**.

See **[ADR-004: Routing and Adapters](adr/004-routing-and-adapters.md)** for the decision record (shared with §7).

---

## 7. Provider Adapters / LLM Integration Layer

> Locked with the Routing Engine under [ADR-004](adr/004-routing-and-adapters.md).

### 7.1 Responsibility

Provider Adapters are the **only** components that speak vendor- or system-specific APIs. Each adapter:

- Formats requests for its destination (public LLM, internal LLM, or internal RAG)
- Handles **streaming** (true proxy stream; no full-response buffering on the happy path)
- Accepts **conversation history** (and summaries) already assembled by Conversation Memory under isolation keys
- Normalises **errors**, **token usage**, and **timings** into a uniform metadata shape
- Returns enough identity for **mandatory model + sub-model attribution**

The Routing Engine and metering layer depend on adapters looking the same from the outside.

### 7.2 Common adapter interface (goals)

All adapters implement one conceptual contract (language-specific shape TBD in implementation):

| Capability | Requirement |
|------------|-------------|
| `invoke` / `stream` | Start a completion (or RAG answer) and stream tokens/events |
| History handoff | Accept ordered turns + optional summary blob from Conversation Memory |
| Cancellation | Propagate client disconnect / deadline |
| Health | Support lightweight health or rely on call outcomes for circuit inputs |
| Metadata | Always return `provider`, `model`, `sub_model` (variant), `request_id`, token counts if available, latency marks |
| Errors | Map to gateway error classes: `transient`, `rate_limited`, `auth`, `invalid_request`, `content_filtered`, `fatal` |

**Why a common interface:** consistent logging, metering, analytics, retries, and circuit decisions — without `if provider == "x"` scattered through the data plane.

### 7.3 Conversation history

- History is loaded and scoped by Conversation Memory (`user_id` + `conversation_id`) **before** the adapter call.
- Adapters receive a **normalised turn list** (and optional summary of older turns), not raw Redis keys.
- Provider-specific packing (e.g. system vs user roles, max turns, multimodal parts later) stays **inside** the adapter.
- Post-DLP redactions in the latest user turn must be what the provider sees.

### 7.4 Model discovery

| Mode | Who / when | Behaviour |
|------|------------|-----------|
| **Periodic background sync** | Platform job; **admin-configurable interval** | Refresh available models/variants from registered providers into the catalogue used by Admin Console and routing eligibility |
| **Manual refresh** | **Super AI Users** (and admins) | On-demand catalogue refresh for that provider or global scope; **audited**; rate-limited so refresh cannot become a DoS |

Discovery updates the **catalogue** of what *can* be bound into purpose ordered lists. It does not by itself change live policy bindings without admin publish — except where product allows auto-bind of new sub-variants under an existing parent (explicit policy; default is admin-controlled).

### 7.5 Mandatory model attribution

Every successful response (UI and API) must clearly indicate generation source, e.g.:

> Response generated by: **Claude 4 Sonnet** (`claude-sonnet-4-…`) via Enterprise LLM Gateway

Requirements:

- **Parent / product name** + **sub-model / variant id** as known from the adapter
- Present on streaming completion (final event and/or response headers/metadata) so clients can always display it
- Same fields land in metering for purpose × model quality analysis (including 1–5 star feedback joins)

### 7.6 Destination types under one abstraction

| `destination.type` | Adapter focus |
|--------------------|---------------|
| `public_llm` | Commercial APIs; controlled egress; streaming chat/completions |
| `internal_llm` | In-VPC / customer-hosted OpenAI-compatible or native endpoints |
| `internal_rag` | Retrieve-and-answer; pass through citations when present |

Routing treats them as ordered candidates the same way; adapters hide protocol differences.

See **[ADR-004: Routing Engine and Provider Adapters](adr/004-routing-and-adapters.md)** for the decision record.

---

## 8. Next architecture sections (planned)

Sections to be added as design deepens:

- [x] Conversation Memory (see §3, ADR-001)
- [x] Policy Engine (see §4, ADR-002)
- [x] Input Guardrails / DLP (see §5, ADR-003)
- [x] Routing Engine (see §6, ADR-004)
- [x] Provider Adapters (see §7, ADR-004)
- [ ] Request path sequence (happy path + failure modes)
- [ ] Semantic cache scoping and invalidation
- [ ] Identity, roles (Normal vs Super AI User), and service accounts (detail beyond §4.4)
- [ ] Data model (entities, retention, redaction)
- [ ] Observability (metrics, logs, traces) and SLOs
- [ ] Deployment topology (VPC, HA, secrets)
- [ ] Threat model and trust-boundary diagrams

---

## Related documents

| Doc | Purpose |
|-----|---------|
| [Overview](overview.md) | Problem, vision, KPIs |
| [Requirements](requirements.md) | Functional and non-functional requirements |
| [Use cases](use-cases.md) | Personas and scenarios |
| [Open questions](open-questions.md) | Unresolved product / tech risks |
| [ADR-001](adr/001-conversation-memory-storage.md) | Locked memory storage decision |
| [ADR-002](adr/002-policy-engine.md) | Locked Policy Engine (OPA) decision |
| [ADR-003](adr/003-input-guardrails-dlp.md) | Locked Input Guardrails / DLP decision |
| [ADR-004](adr/004-routing-and-adapters.md) | Locked Routing Engine + Provider Adapters decision |
