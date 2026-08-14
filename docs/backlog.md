# Backlog — carried from Architecture

Items explicitly **deferred** during Architecture. They are not forgotten; they are out of the locked v1 architecture envelope unless a new ADR says otherwise.

**Source:** [Architecture phase closure](phase-closure/architecture-phase.md) (2026-08-14).

| ID | Item | Why deferred | Home when it lands |
|----|------|--------------|--------------------|
| B1 | **Agent / service-account identity issuance** (Client Credentials or Gateway-issued tokens) | v1 is human SSO only; type is reserved | Supersede/extend ADR-008 |
| B2 | **Private Data Center** implementation (K8s, PG/Redis HA, ClickHouse, Vault) | Phase 1 is GCP only; analogue is documented | ADR-009 follow-on |
| B3 | **Admin API** for automation / GitOps | UI-first console in v1 | ADR-010 follow-on |
| B4 | **Multi-region / active-active HA** | v1 is single-region multi-AZ | ADR-009 follow-on |
| B5 | **File / image / multimodal DLP** | v1 is text prompts only | ADR-003 follow-on |
| B6 | **Output / response guardrails** | Not locked for v1 (F22 P1) | New ADR if it becomes a control-plane requirement |
| B7 | **Fine-grained RBAC**, time-boxed Super/Admin grants, dual-control publish | Static IdP-group map in v1 | ADR-008 / ADR-010 follow-on |
| B8 | Additional **IdPs / SAML** | Google OIDC only in v1 | ADR-008 follow-on |
| B9 | **Request-path sequence** (happy path + failure modes) as a dedicated write-up | Component sections already describe hops | Implementation design note |
| B10 | Physical **data model** (entities, retention, redaction schedules) | Principles locked; schemas not | Implementation design |
| B11 | Implementation **threat-model workshop** / red team | Architecture baseline is §14 | Security workstream |
| B12 | Exact **v1 provider adapter set** and client surface (OpenAI-compatible vs IDE) | Product choice, not a topology lock | Product + ADR-004 implementation |

Still-open product/legal questions (pricing, DPAs, latency proof, classifier quality) stay in [open-questions.md](open-questions.md) until a spike or decision closes them.
