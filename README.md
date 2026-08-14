# Enterprise LLM Gateway

> **Status:** Architecture phase  
> **Repository:** [chandranakkalakunta/enterprise-llm-gateway](https://github.com/chandranakkalakunta/enterprise-llm-gateway)  
> **Owner:** Chandran Nakkalakunta

## What this is

A **governance-first, customer-controlled LLM control plane** that sits between enterprise users (and agents) and multiple model destinations — public LLMs, customer-hosted / internal LLMs, and enterprise internal RAG.

It enforces:

- Purpose-based routing and corporate policy  
- Strong input guardrails / DLP  
- Role-aware behaviour (Normal vs Super AI User)  
- Google OIDC / OAuth 2.0 SSO for human users (fail-closed)  
- Semantic caching  
- Strict per-user, per-conversation memory  
- Privacy-respecting metering and analytics  

Preferred deployment is **inside the corporate firewall / private VPC**.

## Current status

This repository has moved out of general **ideation** into a **dedicated architecture & design** home.

| Phase | Status |
|-------|--------|
| Ideation / problem framing | Done (migrated from `ideas`) |
| Requirements baseline | Captured under `docs/` |
| Architecture | **In progress** |
| Implementation | Not started |

**Locked so far:**

- **Conversation Memory** — Redis (hot) + Managed PostgreSQL (durable) + object storage for attachments. See [ADR-001](docs/adr/001-conversation-memory-storage.md).
- **Policy Engine** — Open Policy Agent (OPA); optional purpose with small/fast LLM auto-classification; admin-managed purposes with mandatory `General` fallback; fail-closed external egress. See [ADR-002](docs/adr/002-policy-engine.md).
- **Input Guardrails / DLP** — Regex + ML/NER (no public LLM for DLP); default redact, hard block for high-sensitivity; admin custom patterns; text-only in v1. See [ADR-003](docs/adr/003-input-guardrails-dlp.md).
- **Routing + Adapters** — Admin-ordered models per purpose; short capped retries; circuit breakers; common adapter interface; mandatory model attribution; stronger agent rate limits; periodic + manual model discovery. See [ADR-004](docs/adr/004-routing-and-adapters.md).
- **Semantic Cache** — Dedicated Vector DB; in-boundary bge/nomic-class embeddings; cosine ~0.88–0.90; per-prompt cache for DLP-clean content only; TTL + manual + source-doc invalidation. See [ADR-005](docs/adr/005-semantic-cache.md).
- **Metering & Feedback** — Private-friendly analytical store; **BigQuery** on GCP Phase 1 and **ClickHouse-class** on Private DC; aggregated long-term data; 1–5 star feedback with metadata only; chargeback/showback-ready. See [ADR-006](docs/adr/006-metering-and-feedback.md) and [ADR-009](docs/adr/009-deployment-topology.md).
- **Observability** — Privacy by default (no raw prompts/responses); OTel + Prometheus + Grafana (+ Loki / Tempo or Jaeger); toggleable per-user metrics; SIEM export; fail-open. See [ADR-007](docs/adr/007-observability.md).
- **Authentication & SSO** — Google OIDC / OAuth 2.0 for human users in v1; short-lived access + refresh tokens; static role mapping with a path to RBAC; fail-closed unauthenticated traffic; agents deferred as a distinct identity type. See [ADR-008](docs/adr/008-authentication-sso.md).
- **Deployment Topology & HA** — Phase 1 on Google Cloud (Cloud Run + GKE hybrid); Private DC documented only; BigQuery on GCP / ClickHouse-class on Private DC; single-region HA; same binary across environments; controlled egress. See [ADR-009](docs/adr/009-deployment-topology.md).
- **Admin Console** — UI-first configuration for Admin role only; no config visibility for non-admins; audited actions; API deferred. See [ADR-010](docs/adr/010-admin-console.md).

Living architecture: [docs/architecture.md](docs/architecture.md).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/overview.md](docs/overview.md) | Problem statement, vision, KPIs |
| [docs/requirements.md](docs/requirements.md) | Functional & non-functional requirements |
| [docs/use-cases.md](docs/use-cases.md) | Personas and scenarios |
| [docs/architecture.md](docs/architecture.md) | **Living architecture** (system context, components, locked decisions through Admin Console) |
| [docs/open-questions.md](docs/open-questions.md) | Open product / technical questions |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [design/](design/) | Working design notes and diagrams (as they land) |

## Repository layout

```text
.
├── README.md
├── design/                 # Working design artefacts
└── docs/
    ├── architecture.md     # Living architecture reference
    ├── requirements.md
    ├── overview.md
    ├── use-cases.md
    ├── open-questions.md
    ├── assets/
    │   ├── logical-component-diagram.jpg
    │   ├── deployment-topology-overview.jpg
    │   └── deployment-topology-gcp-phase1.svg
    └── adr/
        ├── 001-conversation-memory-storage.md
        ├── 002-policy-engine.md
        ├── 003-input-guardrails-dlp.md
        ├── 004-routing-and-adapters.md
        ├── 005-semantic-cache.md
        ├── 006-metering-and-feedback.md
        ├── 007-observability.md
        ├── 008-authentication-sso.md
        ├── 009-deployment-topology.md
        └── 010-admin-console.md
```

## One-sentence summary

A governance-first, customer-controlled LLM control plane that unifies multi-provider routing, purpose-based policy, DLP, internal RAG, conversation memory, and privacy-respecting analytics — private deployment first.

---

*Initialized from the `ideas/enterprise-llm-gateway` workspace into this dedicated repository.*
