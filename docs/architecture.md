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
| 3 | **DLP / Input Guardrail Service** | Detect secrets, PII, regulated patterns, custom IP markers; block / redact / allow before external call. |
| 4 | **Semantic Cache** | Embedding + similarity lookup; store eligible request/response pairs under ACL / purpose scope. Bypass on failure. |
| 5 | **Routing Engine** | Select primary + fallback destinations; provider adapters; health / rate-limit awareness. Public, internal LLM, and RAG as uniform “routes”. |
| 6 | **Conversation Memory** | Multi-turn context per user and conversation; hybrid hot/durable storage; attachment handling; summarisation. See §3. |
| 7 | **Metering & Analytics** | Tokens, cost estimates, purpose, route, latency, cache outcomes; optional 1–5 star feedback as quality signals. Privacy-respecting defaults. |
| 8 | **Audit Log** | Immutable-style record of decisions, overrides, blocks, admin changes. SIEM export. |
| 9 | **Admin API / Console** | CRUD for purposes, maps, roles, DLP rules, cache and memory policy. SSO-protected. |

**Supporting (not counted above):** Provider Adapters (normalise vendor quirks) and Config & Secrets (policy versions, provider keys, RAG endpoints via customer secret manager).

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

## 5. Next architecture sections (planned)

Sections to be added as design deepens:

- [x] Conversation Memory (see §3, ADR-001)
- [x] Policy Engine (see §4, ADR-002)
- [ ] Request path sequence (happy path + failure modes)
- [ ] DLP / guardrail pipeline
- [ ] Semantic cache scoping and invalidation
- [ ] Provider adapter contract and streaming model
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
