# ADR-002: Use Open Policy Agent (OPA) for the Policy Engine

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-25 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | policy-engine, opa, rego, purpose, routing, fail-closed |

## Context

The Gateway is the **source of truth** for corporate AI policy. It must evaluate, on every request (or request-adjacent classification step):

- Purpose → allowed route / model bindings
- Role checks (Normal AI User vs Super AI User)
- Quotas, budgets, and feature flags
- Super-user overrides within allowlists
- Whether external egress is permitted for this purpose and content posture

Requirements that shape the engine choice:

- Policy must be **flexible, auditable, and data-driven** — admins change maps and rules without a full application redeploy for every tweak.
- **Purpose must not be forced on the user.** UX must stay similar to or better than native Claude / Grok / ChatGPT (type and go).
- Prefer **not** to build a full custom rules engine from scratch (cost, correctness, and audit surface).
- External calls must be **fail-closed** when policy evaluation fails or is incomplete.

## Decision

Adopt **Open Policy Agent (OPA)** with **Rego** policies as the Policy Engine runtime.

| Concern | Choice |
|---------|--------|
| Policy runtime | **Open Policy Agent (OPA)** + Rego |
| Purpose on request | **Optional** — never forced in the UI/API contract |
| When purpose missing | **Auto-classify** with a **small/fast LLM** against the admin-managed purpose catalogue |
| Purpose catalogue | **Pre-populated** purposes; admins can **create / modify / delete** |
| Mandatory fallback | Built-in purpose **`General`** — always present; cannot be deleted |
| External egress | **Fail-closed** if policy/DLP evaluation fails or denies |
| Policy configuration | **Data-driven and versioned**; publish immutable snapshots; auditable admin changes |
| Normal AI Users | Follow policy (classified or selected purpose → bound routes) |
| Super AI Users / Agents | May **override within allowlists**; all overrides audited |
| UX bar | Equal or better than native consumer chat (purpose is invisible by default) |

### Evaluation sketch

1. Authenticate and resolve role (Normal / Super AI User / service principal).
2. If client supplies a purpose and it is valid for the principal → use it.
3. Else run **fast classifier** (small LLM) over prompt (+ optional conversation hints) → map to a known purpose or **`General`**.
4. OPA evaluates input: principal, purpose, destination request, quotas, override flags → **allow / deny / route set / constraints**.
5. On evaluation error or deny for external route → **fail-closed** (no public egress).
6. Record decision id, policy version, purpose source (`client` | `classifier` | `default_general`), and any override for audit/metering.

## Consequences

### Positive

- **High flexibility**: change purpose maps, allowlists, and constraints as data + Rego without hard-coding every rule in the proxy.
- **Strong auditability**: OPA decisions + policy version + purpose provenance are first-class audit fields.
- **Separation of concerns**: data plane stays thin; policy logic lives in OPA bundles / data documents.
- **UX preserved**: users are not forced through purpose pickers; classification + `General` cover the happy path.
- Industry-standard tooling (OPA) rather than a bespoke rules engine.

### Negative / trade-offs

- **Learning curve** for Rego and OPA operational patterns (bundles, decision logs, partial evaluation).
- **Extra component** to run, secure, scale, and monitor (sidecar or central OPA; latency budget still applies).
- Classifier adds a small amount of latency and cost when purpose is omitted (mitigate with small/fast model, cache of recent classifications per conversation, timeouts + fall back to `General` where policy allows).
- Misconfigured Rego can be as dangerous as misconfigured app code — needs review, tests, and staged publish.

### Neutral

- Semantic Cache and Conversation Memory remain separate; OPA may receive purpose and ACL scope as inputs but does not own those stores.
- Exact packaging (embedded OPA vs remote) and classifier model choice may get follow-up ADRs; the engine choice (OPA) and purpose model are locked here.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Hard-coded policy in application code | Slow to change; weak for admin self-service; harder multi-tenant policy versioning |
| Homegrown rules DSL / engine | High build and security cost; reinventing evaluation, testing, and audit |
| Force purpose selection in UI | Violates UX bar vs native Claude / Grok / ChatGPT |
| No `General` fallback | Classifier ambiguity would block users or invent ad-hoc routes |
| Fail-open on policy errors | Unacceptable for external egress of corporate data |

## Related

- [Architecture §4 — Policy Engine](../architecture.md#4-policy-engine)
- Requirements: F2, F3, F5 (policy routing, purpose maps, Normal vs Super AI User)
- [ADR-001: Conversation Memory Storage](001-conversation-memory-storage.md)
