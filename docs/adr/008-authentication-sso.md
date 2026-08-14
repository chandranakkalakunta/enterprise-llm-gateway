# ADR-008: Authentication & SSO Design (Human Users v1)

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | authentication, sso, oidc, oauth2, google, rbac, fail-closed, agents |

## Context

Every request that enters the Gateway must carry a **reliable identity and role context**. Policy (ADR-002), conversation isolation (ADR-001), metering (ADR-006), and audit all depend on knowing *who* is calling and *what kind of principal* they are. Auth is therefore the first hop on the data plane, not an afterthought bolted onto Policy.

Constraints that shape the decision:

- **v1 focuses on human users.** Interactive employees (chat, IDE, Admin Console) must sign in through a real enterprise identity provider.
- **Agents and other non-interactive clients** will need a different identity model. They must not impersonate people by reusing human SSO credentials.
- Role assignment must start simple (**static mapping**) but the request context must allow evolution to **full RBAC-driven mapping** without redesigning authn.
- Unauthenticated or unvalidatable traffic must be **fail-closed** — reject all. There is no anonymous “try the model” path.
- Downstream components (Policy, DLP, cache, routing, memory, metering) must **not** need to understand Google tokens. After validation, the Gateway owns an **internal request context**.
- Logout and revocation should follow **standard OAuth / OIDC patterns** where practical.

The organisation’s current IdP is **Google** (Google Workspace / Cloud Identity). Other IdPs and protocols remain a later extension, not a v1 requirement.

## Decision

Adopt **Google OIDC / OAuth 2.0** as the primary identity provider for **human users in v1**, with a Gateway-owned session and an internal request context after validation.

| Concern | Choice |
|---------|--------|
| Primary IdP (v1) | **Google** via **OIDC / OAuth 2.0** |
| v1 principal scope | **Human users only** (interactive clients + Admin Console) |
| Protocol | Authorization Code flow; **PKCE** for public / native clients |
| Token model | **Short-lived access tokens** + **refresh tokens** (standard OAuth / OIDC) |
| Validation | Gateway verifies issuer, audience, signature (Google JWKS), expiry, and required claims |
| After validation | Establish an **internal request context**; downstream hops never parse Google tokens |
| Role mapping (v1) | **Static mapping** (IdP group / claim / allow-listed identity → Gateway role) |
| Role mapping (later) | Same context shape feeds **RBAC-driven** mapping in Policy / admin data |
| Unauthenticated / invalid | **Fail-closed** — reject all |
| Agents / non-interactive | **Deferred**; designed as a **distinct identity type**. Preferred: **OAuth 2.0 Client Credentials** or **Gateway-issued agent tokens**. Human SSO credentials must **never** be reused by agents |
| Logout / revocation | Standard **token revocation** and **session termination** where practical |
| Additional IdPs | Not v1; context and interfaces stay IdP-agnostic so OIDC peers (or SAML later) can be added |

### Human sign-in sketch

1. Client presents no valid Gateway session or bearer token → start Google OIDC Authorization Code (+ PKCE when the client cannot hold a secret).
2. Google authenticates the user and returns an authorization code.
3. Token endpoint exchange yields **ID token**, **access token**, and **refresh token**.
4. Gateway validates the ID / access token against Google (JWKS, `iss`, `aud`, `exp`, `sub`).
5. Gateway applies the **static role map** (e.g. IdP group → Normal AI User / Super AI User / Admin).
6. Gateway creates a **session** and an **internal request context** (principal id, principal type `human`, role, retained groups/claims, expiry, IdP, mapping version).
7. Subsequent API calls send the Gateway-accepted access token (or session). On expiry, the client uses the **refresh token**; refresh failure is fail-closed.
8. Policy, DLP, memory, routing, and metering consume **only** the internal context.

### Internal request context (contract)

The context is the only identity artefact downstream components may depend on. Minimum fields:

| Field | Intent |
|-------|--------|
| `principal_id` | Stable subject (`sub` from the IdP), not a display email as the primary key |
| `principal_type` | `human` in v1; `agent` reserved as an extension point |
| `role` | Gateway role from the current mapper (`normal_ai_user` \| `super_ai_user` \| `admin`) |
| `groups` / raw claims | Retained (or referenced) so RBAC can replace the static mapper later |
| `session_id` | Gateway session for logout / revocation correlation |
| `auth_time` / `token_exp` | Bound the request to a live credential |
| `idp` | `google` in v1; enum stays open |
| `mapping_source` / version | `static` + map snapshot id today; `rbac` later |

Logs and traces follow ADR-007: prefer hashed / pseudonymous principal refs; do not treat email as a high-volume label.

### Static mapping → RBAC

v1 mapping is an admin-maintained table: IdP group, hosted domain, or allow-listed identity → exactly one Gateway role. Unmapped authenticated users are **denied** (fail-closed), not silently granted Normal.

The mapper is a **replaceable step** after token validation. When RBAC lands, the same claims populate Policy data (OPA inputs, purpose/resource permissions, Super-user grants). Authn does not change; only how `role` and entitlements are derived.

### Agents (extension point, not v1)

Agents are a **different identity type**, not “a user with a long-lived cookie.” Full issuance, rotation, and binding are deferred. The reserved direction is:

- **OAuth 2.0 Client Credentials**, or
- **Gateway-issued agent tokens** (audience-bound, short-lived, rotatable)

Human refresh tokens, ID tokens, and passwords must never be copied into an agent runtime. `principal_type = agent` is already a first-class dimension in metering and observability (ADR-006, ADR-007) so the split is measurable the day agents ship.

### Fail-closed and logout

- Missing, expired, malformed, wrong-audience, or unverifiable tokens → **401 / 403**; no Policy evaluation, no provider call.
- Google unreachable for **new** sign-in or **refresh** → fail-closed for those attempts. Unexpired, already-validated access tokens may continue until they lapse (short lifetime is the mitigation).
- Logout: Gateway session termination + **refresh-token revocation** (and RP-initiated logout to Google where the client is a browser). Access tokens die by **short TTL**; introspection can be added later if a customer requires immediate access-token kill.

## Consequences

### Positive

- **Standard, well-understood auth** for human users (OIDC / OAuth 2.0) instead of a bespoke SSO protocol.
- **Simple to operate in v1**: one IdP, static role map, short-lived tokens, refresh for UX.
- Downstream stays **IdP-agnostic** via the internal request context.
- **Clear extension point for Agents** without redesigning human SSO or Policy inputs.
- Fail-closed unauthenticated traffic matches the Gateway’s security posture (Policy / DLP egress).

### Negative / trade-offs

- **Static mapping is a temporary simplification.** Standing group → Super AI User grants can sprawl; RBAC, time-boxed grants, and access review must replace it (open question on Super-user governance remains).
- **Dependency on Google IdP availability** for new sessions and refresh. Mitigate with short access-token lifetime, normal refresh handling, and an ops runbook for break-glass admin — not by fail-opening the data plane.
- v1 does **not** ship multi-IdP or SAML; some enterprises will need a follow-up IdP adapter.
- Agent identity is only an extension point in v1; automation callers cannot be treated as production-ready until Client Credentials or Gateway-issued tokens land.

### Neutral

- Policy Engine remains the authority for *what the principal may do* (purpose, egress, Super-user allowlists). Authn only answers *who* and *which coarse role / claims*.
- Conversation Memory isolation keys continue to use `user_id` (from `principal_id`) + `conversation_id`.
- Additional OIDC providers should implement the same validation → context → mapper pipeline; they do not get a second request-context schema.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| SAML-first (or SAML + OIDC in v1) | Valid enterprise protocol; heavier for the current Google-centric v1. Revisit as an IdP adapter, not the core |
| API keys or shared secrets for human users | No real SSO, weak group/role binding, poor revocation UX |
| Pass Google tokens through every component | Couples Policy, memory, and metering to one vendor’s token shape |
| Long-lived opaque sessions only (no OIDC tokens) | Fights standard client ecosystems and refresh / revocation practice |
| Full RBAC in v1 | Correct destination; too much to lock before the human SSO path exists |
| Fail-open for missing/invalid auth | Unacceptable on a governance control plane |
| Agents reuse human refresh / ID tokens | Credential sharing and audit-breaking impersonation |
| Multiple IdPs in v1 | Dilutes the first ship; context is already multi-IdP-ready |

## Related

- [Architecture §11 — Authentication & SSO](../architecture.md#11-authentication--sso)
- Requirements: F23 (corporate IdP / SSO); F2 / F5 / F13 (identity + role); F17 (agents as distinct consumers)
- [ADR-002: Policy Engine](002-policy-engine.md) — consumes role / principal after authn
- [ADR-001: Conversation Memory Storage](001-conversation-memory-storage.md) — isolation by `user_id`
- [ADR-006: Metering & Feedback](006-metering-and-feedback.md) — `principal_type` human \| agent
- [ADR-007: Observability](007-observability.md) — auth on the trace path; no emails as high-cardinality labels
