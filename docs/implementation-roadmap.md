# Implementation Roadmap — Enterprise LLM Gateway

> **Status:** Accepted as the high-level implementation plan  
> **Last updated:** 2026-08-15  
> **Architecture:** [Complete](phase-closure/architecture-phase.md) (ADR-001–010 + [§14 Threat Model](architecture.md#14-threat-model))  
> **Testing:** [docs/testing-strategy.md](testing-strategy.md) — required every phase  
> **Deferrals:** [docs/backlog.md](backlog.md)

Sub-phases are **not** specified here. They are designed at the **start of each phase**, after a design discussion, so later phases can absorb what we learned.

---

## 1. Purpose

Move from a **closed Architecture** to a **production-grade, customer-VPC Gateway on Google Cloud**, in six explicit phases.

This document is the sequencing contract: what each phase must achieve, what it must **not** absorb, and what evidence is required to close it. It does not reopen locked ADRs. A new ADR is required only if implementation discovers that a locked decision cannot stand.

---

## 2. Principles

| Principle | Meaning |
|-----------|---------|
| **Phase-by-phase delivery** | Each phase has a goal, capabilities, **exit criteria**, and recorded test evidence. Merged code is not “done.” |
| **Sub-phases at phase start** | Breakdown, spikes, and the first execution prompt are written **when the phase opens**, not now. |
| **Design discussion before execution** | No implementation prompt until the phase’s design note and sub-phase list exist. |
| **Testing every phase** | Unit/component + integration + phase-exit verification. Fuller pack in Phase 6 / release. See [testing-strategy.md](testing-strategy.md). |
| **UI Specification before UI build** | Admin Console (and any user-facing UI) waits on a UI Spec **after this roadmap** and **before** that work in Phase 5. |
| **Private-first, GCP Phase 1** | Customer VPC on Google Cloud. Same binary and configuration model as a future Private DC (ADR-009). |
| **Production-grade over speed theater** | Fail-closed auth/egress, no raw prompts in default telemetry, pinned dependencies, evidence at the gate. |

---

## 3. Phase overview

| Phase | Name | Goal | Exit focus |
|-------|------|------|------------|
| **1** | Foundation | Deployable skeleton on GCP | Authn, one thin request path, secrets, minimal observability, smoke |
| **2** | Control Plane | Govern the hop | OPA + purpose + text DLP; fail-closed egress |
| **3** | Routing & Providers | Reach real models | Ordered lists, adapters, attribution, retries/fallback |
| **4** | Memory & Cache | Multi-turn + cost/latency | Redis + Cloud SQL memory; in-boundary semantic cache |
| **5** | Metering, Feedback & Admin | Operate and configure | BigQuery metering, 1–5★, Admin Console (after UI Spec) |
| **6** | Hardening & HA | Release-ready | Single-region HA, abuse controls, full test pack, runbooks |

Phase 1–6 is the **v1 implementation envelope**. Items in §6 stay out unless explicitly pulled forward with a decision note (and an ADR if they change a lock).

---

## 4. Phase summaries

### Phase 1 — Foundation

**Goal.** A **deployable skeleton** in a customer GCP project: identity, a thin request path, hybrid compute as needed, secrets, and enough observability to see the hop.

**Major capabilities**

- Google OIDC / OAuth 2.0 for **human** users; fail-closed unauthenticated traffic (ADR-008)
- Internal request context after validation (downstream does not parse Google tokens)
- Thin data-plane service (OpenAI-compatible and/or native stub) that can accept an authenticated request
- **Cloud Run + GKE** as needed for the skeleton (ADR-009); Workload Identity + Secret Manager
- Minimal structured logs / metrics (ADR-007 posture: no raw prompts)
- CI harness and first **Smoke** + unit tests ([testing strategy](testing-strategy.md) §4–5)

**Exit criteria**

- Deployed to a non-prod GCP environment in the customer VPC pattern
- Anonymous request rejected; authenticated request reaches a stub (or safe echo) **without** calling a public model unless explicitly allowed by a later phase
- Secrets not on disk / not in the image
- Phase-exit evidence recorded (smoke + unit; integration as soon as a composition exists)

**Tests.** Foundation emphasis: harness, fixtures, CI skeleton, first smoke. Privacy-preserving samples only.

**Non-goals this phase:** OPA/DLP, real provider adapters, memory/cache, Admin Console, BigQuery metering, HA hardening, Agent tokens, Private DC.

---

### Phase 2 — Control Plane

**Goal.** The hop **governs**: purpose, policy, and text DLP decide whether anything may leave the trust boundary.

**Major capabilities**

- OPA + versioned policy snapshots; optional purpose; classifier or `General` fallback (ADR-002)
- Text Input Guardrails / DLP: redact default, hard block when the profile says so; fail-closed on scanner/policy failure for **external** routes (ADR-003)
- Purpose handling on the path (client | classifier | `default_general` provenance)
- Static role map consumed as Policy input (Normal / Super / Admin)

**Exit criteria**

- Deny / evaluation failure on an external route produces **no provider call**
- DLP redact vs block demonstrable on synthetic fixtures
- Unmapped or unauthenticated principals still fail-closed
- Phase-exit: functional + **Security/Guardrail** cases for the new surfaces

**Tests.** Authz/purpose spoof, DLP redact/block, fail-closed egress. Injection samples must not change OPA outcomes.

**Non-goals this phase:** Multi-provider routing, conversation memory, semantic cache, Admin UI, file/image DLP, Agent issuance.

---

### Phase 3 — Routing & Providers

**Goal.** Policy-allowed requests reach **real destinations** through a common adapter interface.

**Major capabilities**

- Routing Engine: ordered models per purpose; `General` fallback (ADR-004)
- Provider Adapters: public LLM, internal LLM, internal RAG as destination types
- Mandatory **model + sub-model attribution**
- Short capped retries and fallback; circuit-breaker **hooks** (full HA behaviour lands in Phase 6)
- Streaming proxy on the happy path (no full-response buffer)

**Exit criteria**

- At least one public and one in-boundary-style adapter path proven (internal may be stubbed if no live RAG yet)
- Attribution present on successful responses
- Retry/fallback bounded; failure class mapped
- Phase-exit: functional + adapter contract tests; streaming/cancel as soon as streams exist

**Tests.** Adapter error mapping; ordered-list advancement; no leak of pre-DLP text to the provider.

**Non-goals this phase:** Semantic cache, durable conversation memory (beyond whatever stub Phase 1–2 used), Admin Console, production rate-limit productisation (skeletons OK; abuse pack is Phase 6).

---

### Phase 4 — Memory & Cache

**Goal.** Correct **multi-turn** isolation and a **governed** semantic cache.

**Major capabilities**

- Conversation Memory: Redis hot + Cloud SQL PostgreSQL durable + object storage for attachments (ADR-001)
- Isolation `user_id` + `conversation_id`; summarisation hooks as designed
- Semantic Cache: dedicated private-friendly Vector DB + in-boundary embeddings; cosine; DLP-clean per-prompt only (ADR-005)
- Cache fail-open (bypass on cache failure); Policy + DLP still run before a hit is served

**Exit criteria**

- Cross-user memory read is impossible under tests
- Cache miss/hit paths both work; redacted/sensitive content is **not** stored as a shared entry
- Phase-exit: isolation + cache-scope tests; functional regression of Phases 2–3

**Tests.** Isolation, cache scope (purpose + sensitivity), fail-open cache, no cross-purpose hit.

**Non-goals this phase:** Admin Console, BigQuery productisation (events may be stubbed), file/image DLP, multi-region cache.

---

### Phase 5 — Metering, Feedback & Admin

**Goal.** Operators can **see usage** and **change configuration** without a code deploy.

**Major capabilities**

- Async metering to **BigQuery** (metadata only; ADR-006 + ADR-009)
- Optional **1–5 star** feedback joined to request metadata, not bodies
- **Admin Console UI** — **only after** the UI Specification exists
- Admin role only; no config visibility for Super/Normal users (ADR-010)
- Policy snapshot publish (draft → validate → activate) from the console
- v1 console areas: purposes, ordered lists, DLP profiles/patterns, quotas (as far as Phase 6 will enforce), cache settings, operational links

**Exit criteria**

- Meter events contain no raw prompts in fixtures or CI logs
- Admin-only routes 403 without leakage
- Publish is versioned and audited
- UI matches the approved UI Spec for the v1 surfaces
- Phase-exit: functional + guardrail (admin 403, audit) + metering privacy checks

**Tests.** Per [testing strategy](testing-strategy.md) Phase 5 row. UI tests as specified in the UI Spec (not invented here).

**Non-goals this phase:** Admin **API** (backlog B3), full user management (IdP owns it), log explorer UI, Agent credential UI, HA soak.

---

### Phase 6 — Hardening & HA

**Goal.** A **release candidate**: single-region HA, abuse controls, observability that operators can run, and the **full** test pack.

**Major capabilities**

- Single-region multi-AZ HA for compute and stateful services (ADR-009)
- Rate limits / quotas / abuse controls per user, agent (when present), and purpose (ADR-004)
- Circuit breakers in production posture; runbooks for IdP down, provider storm, snapshot rollback
- Tighter observability: RED + domain signals; SIEM export path; break-glass still time-limited
- Stronger test pack: full regression, security/guardrail, performance, HA-related verification

**Exit criteria**

- Recorded **Regression + Security/Guardrail + Performance + post-deploy Smoke**
- HA checks in v1 scope (zone/process restart, fail-open cache/telemetry vs fail-closed auth/egress)
- Runbooks exist and have been walked
- Phase-closure record for Implementation (or release candidate) with evidence links

**Tests.** [Testing strategy](testing-strategy.md) §4 Phase 6 / release candidate. No multi-region soak.

**Non-goals this phase:** Private DC build, multi-region active-active, chaos-at-scale, pulling entire backlog unless a named decision says so.

---

## 5. Cross-cutting work

| Work | When |
|------|------|
| **UI Specification** | **After this roadmap**, **before** Admin Console / any user UI implementation (Phase 5) |
| **Testing Strategy** | Applies **every** phase; suites named in [testing-strategy.md](testing-strategy.md) |
| **Documentation hygiene** | At each phase boundary: README/status, phase-exit note, backlog updates, no stale “in progress” lies |
| **Backlog** | [docs/backlog.md](backlog.md) holds Architecture deferrals; do not silently implement them inside Phases 1–6 |
| **Same binary / config** | Environment values change; the application does not fork (ADR-009) |
| **Design-before-execute** | Each phase opens with a short design discussion and a sub-phase list; then execution prompts |

---

## 6. Deferred (not in Phase 1–6 unless pulled forward)

These remain **out of the v1 envelope**. Pull-forward requires an explicit note (and a new ADR if a lock changes).

| Item | Backlog |
|------|---------|
| Private Data Center implementation | B2 |
| Full Agent / service-account identity issuance | B1 |
| File / image / multimodal DLP | B5 |
| Admin configuration API | B3 |
| Multi-region / higher HA | B4 |
| Output guardrails, extra IdPs, dual-control publish, formal red team | B6, B8, B7, B11 |

Other B-items (request-path write-up, physical data model, exact v1 provider set) are implementation design work that may appear as **notes inside** a phase, not as extra phases.

---

## 7. Next step after this document

1. **Create the UI Specification** (Admin Console v1 surfaces; any reference client UI if in scope).
2. **Open Phase 1** with a design discussion and **sub-phase breakdown**.
3. Execute Phase 1 against [testing-strategy.md](testing-strategy.md) (harness, first smoke, recorded exit).

Do not start Phase 1 implementation prompts until step 2 exists.
