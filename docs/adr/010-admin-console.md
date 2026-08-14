# ADR-010: Admin Console — UI-first Configuration Surface

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | admin-console, ui-first, rbac, audit, policy, dlp, configuration |

## Context

Platform admins (AI CoE / corporate admin) must be able to configure **purposes**, **ordered model lists**, **DLP profiles and custom patterns**, **rate limits / quotas**, **cache policy**, and **which policy snapshot is live** — without a code deploy and without opening a ticket to engineering for every map change.

Constraints that shape the surface:

- The primary users are a **small number of admins**, not Normal AI Users, Super AI Users, or external automation.
- Showing configuration to non-admins creates **organisational noise** and invites “why can’t I change that?” authority questions. Super AI Users may override **within allowlists** on the data plane (ADR-002); they do **not** operate the control plane.
- Identity and group membership already live in the **IdP** (ADR-008). The console must not become a second user directory.
- Architecture-phase scope is **high-level only**. Screen layouts, component libraries, and field-level UX are later work.
- Every admin change is a governance event. It must be **audited** (who, what, when, before/after or equivalent, policy version).

An Admin API will be useful later for automation. It is **not** the v1 primary surface.

## Decision

Ship a **UI-first Admin Console** as the primary configuration surface. The API is **secondary / deferred**.

| Concern | Choice |
|---------|--------|
| Primary surface | **UI-first Admin Console** |
| API | **Deferred / secondary** — for automation or external systems later; same underlying config model |
| Access | **Admin role only** (from the static map / later RBAC — ADR-008) |
| Non-admin visibility | **None.** Normal AI Users and Super AI Users do **not** see admin configuration |
| Authn | Same Google SSO as the rest of the Gateway (ADR-008); console is not a separate password store |
| Audit | **Every** admin action is written to the Audit Log |
| Architecture depth | **High-level** for this phase — responsibilities and scope, not screen specs |
| Placement (GCP Phase 1) | Cloud Run, same binary/config model (ADR-009) |

### v1 functional areas

The console is the human front-end onto already-locked control-plane data (policy snapshots, DLP profiles, cache flags, quotas):

| Area | What admins do |
|------|----------------|
| **Purposes** | Create / rename / retire purposes; `General` is mandatory and not deletable (ADR-002) |
| **Ordered model lists** | Bind an ordered candidate list per purpose; manage Super-user allowlists |
| **DLP** | Profiles, category → redact/block, **custom patterns** (ADR-003) |
| **Rate limits / quotas** | Per user, per agent, per purpose (ADR-004) |
| **Cache settings** | Enable/disable per purpose, thresholds, TTL, manual invalidation (ADR-005) |
| **Policy version activation** | Draft → validate → **publish** a snapshot the data plane pins (ADR-002) |
| **Basic operational links** | Deep-links or status to observability / metering dashboards — not a second Grafana |

Publish remains **data-driven and versioned**. The console does not hot-edit the live snapshot mid-request.

### Explicit non-goals (v1 console)

| Out of scope | Where it lives instead |
|--------------|------------------------|
| Full **user management** (create users, reset passwords, group CRUD) | **IdP** (Google Workspace / Cloud Identity) |
| Complex **visual policy builders** / Rego IDEs | Structured forms + versioned data; OPA authors use normal policy workflow if needed |
| Real-time **log / trace exploration** | Observability stack (ADR-007) |
| Prompt archives / conversation browsing | Conversation Memory access controls — not the admin home |
| Agent credential issuance | Deferred with agent identity (ADR-008) |

Some v1 configuration will be **form-driven or structured** (tables, ordered lists, YAML/JSON-backed editors) rather than fully visual. That is acceptable.

### Access and audit

1. Console requires an authenticated session **and** Gateway role `admin`.
2. Non-admins who hit console routes receive **404 / 403 with no config leakage** — not a greyed-out UI that reveals the catalogue.
3. Writes go through the same publish path as any future API: validate → snapshot → audit event.
4. Audit fields include actor `principal_id`, action, object type/id, snapshot version, timestamp. No secrets or raw prompt bodies.

## Consequences

### Positive

- **Faster delivery** of useful admin capability — a focused UI for a handful of operators, not a public API programme.
- **Clear separation of duties**: Super AI Users stay on the data plane; admins own configuration.
- The **config model stays API-ready**. A later Admin API can sit on the same snapshots and audit rules without redesign.
- Reduces pressure to expose policy internals to the whole company.

### Negative / trade-offs

- Automation (GitOps, Terraform, SIEM-driven disable) waits on the **secondary API** or a documented snapshot import path.
- Form-driven editors will feel less polished than a visual policy canvas. Mitigate with good defaults, validation, and dry-run publish.
- Admin-role sprawl is still an operational risk (ADR-008 static mapping). Console access inherit that until RBAC / time-boxed grants land.

### Neutral

- Policy Engine, DLP, cache, and routing remain the systems of record for *enforcement*. The console is how humans **change the data** those systems read.
- Metering and observability stay separate products/surfaces; the console only **links** to them in v1.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| API-first, UI later | Wrong audience for v1; a few admins need a console, not an SDK |
| Show config (read-only) to Super AI Users | Creates noise and authority questions; overrides already have an audited data-plane path |
| Full user-management module | Duplicates the IdP; violates “integrate, don’t reinvent” |
| Visual Rego / graph policy builder in v1 | High cost; structured publish is enough to operate the locked model |
| In-console live log explorer | Duplicates Grafana/Loki/Tempo; privacy and cardinality belong in ADR-007 |

## Related

- [Architecture §13 — Admin Console](../architecture.md#13-admin-console)
- Requirements: F3 (purpose maps); F5 (Normal vs Super); F23 (SSO)
- [ADR-002: Policy Engine](002-policy-engine.md)
- [ADR-003: Input Guardrails / DLP](003-input-guardrails-dlp.md)
- [ADR-004: Routing and Adapters](004-routing-and-adapters.md)
- [ADR-005: Semantic Cache](005-semantic-cache.md)
- [ADR-007: Observability](007-observability.md)
- [ADR-008: Authentication & SSO](008-authentication-sso.md)
