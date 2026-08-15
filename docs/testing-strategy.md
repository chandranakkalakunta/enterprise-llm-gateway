# Testing Strategy — Enterprise LLM Gateway

> **Status:** Living engineering document (not an ADR)  
> **Last updated:** 2026-08-15  
> **Applies from:** Implementation Phase 1 onward  
> **Supersede with an ADR only if** a lasting testing *decision* (framework, gate, environment contract) needs to be locked.

Architecture is closed ([phase closure](phase-closure/architecture-phase.md)). This document states **how we prove the Gateway works** as implementation proceeds. It does not reopen ADR-001–010.

---

## 1. Purpose

The Gateway sits on the **hot path of every enterprise AI request**. A merge without evidence is not “done.” This strategy exists so that:

- Every implementation phase ships **testable** behaviour, not only code
- Phase exit and release are **evidence-gated** (Multi-Agent Protocol v4.3: no silent “merged = done”)
- Privacy posture from ADR-006 / ADR-007 holds **in CI** — tests must not leak real secrets or raw employee prompts into logs
- Quality intensifies toward **Phase 6 (Hardening & HA)** and any production release, rather than appearing only at the end

**Production-grade bar:** automated suites first; recorded pass/fail at phase exit; **smoke before deploy**; broader suites before release.

---

## 2. Principles

| Principle | Meaning |
|-----------|---------|
| **Test in every phase** | Unit/component + integration for new paths in the same phase that introduces them. Hardening is extra, not the first time we test. |
| **Evidence at phase exit** | A phase is complete only when the checklist has **recorded** results (pass/fail, command or CI link, notes). A green PR merge is not sufficient by itself. |
| **Privacy-preserving tests** | Use synthetic fixtures and **redacted** samples. Never commit real API keys, production prompts, or live PII. CI logs follow the same allow-list spirit as ADR-007. |
| **Automate first** | Default path is CI. Manual checks are allowed only where a human must judge UX or a live IdP/provider quirk — and those still get a written result. |
| **Failures block** | Failing unit/integration **blocks merge**. Failing phase-exit suite **blocks phase completion**. Failing smoke **blocks deploy**. Failing release pack **blocks release**. |
| **Fail-closed behaviour is a test target** | Unauthenticated traffic, Policy/DLP deny, and missing snapshots must be **asserted**, not only the happy path (§14 Threat Model). |

---

## 3. Test suites

Named suites are the vocabulary used in phase plans, CI jobs, and exit reports.

| Suite | Purpose | Typical grain | When it runs |
|-------|---------|---------------|--------------|
| **Smoke** | Is the deployed (or deployable) system **alive** and able to complete one governed request? Auth rejects anonymous; health; one allow-path (or explicit dry-run). | Minutes; few cases | **Before/after every deploy**; start of a phase-exit check |
| **Functional** | Does **this phase’s** behaviour match the locked design? New APIs, policy publish, DLP action, cache hit/miss, role mapping, admin-only console, etc. | New and adjacent paths | Every phase, continuously in CI; re-run at phase exit |
| **Regression** | Did we **break** previously shipped behaviour? | Prior phases’ functional set, frozen as a pack | CI on main (growing); **full pack** before release and in Phase 6 |
| **Security / Guardrail** | Can an attacker or careless user **bypass** identity, policy, DLP, or isolation? | Authn/authz, prompt-injection samples, DLP redact/block, purpose spoof, cache scope, admin 403, no raw prompts in logs | Every phase for **new** surfaces; **full pack** in Phase 6 and before release |
| **Performance** | Does the hop stay within the **latency / throughput** story? Cache behaviour; no full-response buffering on the stream. | p50/p95 gateway overhead (directional &lt; 30 ms p50 in-region, excluding provider); TTFT; cache hit path; quota 429 under load | Light checks as soon as a data plane exists; **dedicated** pack in Phase 6 |

**Security / Guardrail** is a first-class suite, not a footnote. Minimum themes (expand when each phase starts):

- Unauthenticated / wrong-audience / expired token → **401/403**, no provider call (ADR-008)
- Non-admin → Admin Console **no config leakage** (ADR-010)
- Purpose spoof / out-of-allowlist Super override → **deny** (ADR-002)
- Synthetic secrets in a prompt destined externally → **redact or block**; scanner failure on external route → **block** (ADR-003)
- Prompt-injection / “ignore policy” samples do **not** change OPA outcomes
- Cache must not serve across purpose/sensitivity; redacted text is not a shared key (ADR-005)
- Isolation: no cross-`user_id` memory read (ADR-001)

**Performance** does not require a multi-region soak in v1 (single-region HA — ADR-009). It does require **measured** overhead on the path that will ship.

---

## 4. Per-phase expectations

Every implementation phase, including Foundation:

1. **Unit / component tests** for new modules (policy snapshot load, DLP matchers, token validation, adapter error mapping, cache key builder, …).
2. **Integration tests** for new request paths (in-process or docker-compose / ephemeral GCP-like stack as the repo grows).
3. **Phase-exit verification** — a short written checklist: suites run, results, gaps, follow-ups. Coordinator signs the evidence; Strategist owns the bar.

**Phase 6 / release candidate** (Hardening & HA) additionally requires:

- Full **Regression** pack (all prior functional cases)
- Full **Security / Guardrail** pack (including §14 abuse cases that are in scope for the shipped surface)
- **Performance** pack (latency overhead, a throughput/saturation note, cache hit vs miss)
- **HA-related verification** in scope for v1: multi-AZ / process restart, circuit-breaker behaviour, fail-open cache/telemetry vs fail-closed auth/egress — **not** multi-region active-active
- Release **smoke** against the candidate environment after deploy

Sub-phase test lists are written **when that phase starts**. This document does not invent them.

---

## 5. Mapping to implementation phases (high level)

Intensity **grows**; it does not appear from nowhere in Phase 6.

| Phase (indicative) | Testing emphasis |
|--------------------|------------------|
| **1 — Foundation** | Harness, fixtures, CI skeleton, first unit tests, first smoke against whatever is deployable |
| **2–3 — Data plane / policy / DLP** | Functional + guardrail cases for auth, OPA, DLP, fail-closed egress |
| **4 — Cache, memory, routing, adapters** | Isolation and cache-scope tests; adapter contract tests; streaming/cancel |
| **5 — Admin, metering, observability** | Admin-only access; audit events; **no raw prompts** in meter/log fixtures |
| **6 — Hardening & HA** | Full regression + security pack + performance + HA checks; release evidence |

Phase names match the [Implementation Roadmap](implementation-roadmap.md). If numbering ever shifts, **this table’s intent stays**: early harness, mid-phase functional/guardrail, late full pack.

---

## 6. Automation and evidence

| Rule | Practice |
|------|----------|
| **Tests live with the code** | Same repository; same PR as the behaviour. No orphan “we’ll test later” folders as the only coverage. |
| **CI early** | Unit tests on every PR as soon as a language/toolchain exists. Integration as soon as there is a runnable composition. |
| **Phase exit is a record** | Pass/fail per suite, link to CI run or local log path, date, who ran it, notes on skips. Store under the phase’s evidence convention (phase-closure or CI artefacts) — not a verbal “looked good.” |
| **Smoke around deploys** | Required on the environment just deployed (or a canary). Failure → **do not** promote traffic. |
| **Release** | Regression + Security/Guardrail + Performance + post-deploy Smoke, all recorded. |
| **Dependencies** | Tests that need Google OIDC, live providers, or BigQuery use **fakes or recorded contracts** in CI by default. Live-env tests are explicit, secret-safe, and not the merge gate unless the phase says so. |

Pinned versions and `requirements.txt` / lockfiles apply to test tooling the same way they apply to runtime (no ad-hoc pip lists in CI).

---

## 7. Explicit non-goals / deferred

| Deferred | Why |
|----------|-----|
| Full **chaos engineering** (random pod kill, region drain) | Later than v1 Phase 6; HA checks stay scoped to single-region |
| Exhaustive **multi-region** performance | Multi-region HA is not v1 (ADR-009 / backlog B4) |
| **Customer-specific UAT** scripts and sign-off rituals | Outside this core strategy; a customer may add them |
| Formal **penetration test** / red-team report | Implementation workshop (backlog B11); this doc only requires the automated guardrail pack |
| 100% coverage as a vanity gate | Coverage is measured and gated against **actual** coverage minus a small buffer when we have a baseline — not an aspirational number on day one |

---

## 8. Ownership

| Role | Responsibility |
|------|----------------|
| **Strategist** | Owns this document, phase-exit **bars**, and which suite is required to close a phase or release |
| **Worker** | Implements tests **with** the product code; keeps fixtures synthetic and CI green |
| **Coordinator** | Validates **evidence** at phase exit and before deploy/release; refuses “merged = done” |

Disputes about “is this enough to close the phase?” are Strategist calls, recorded in the phase-exit note.

---

## Related

- [Architecture](architecture.md) — especially §14 Threat Model (abuse cases to encode)
- [Requirements](requirements.md) — F-list is what Functional/Regression must eventually cover
- [Backlog](backlog.md) — B11 threat-model workshop; B4 multi-region
- [Architecture phase closure](phase-closure/architecture-phase.md)
