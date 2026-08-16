# Enterprise LLM Gateway

> **Status:** Architecture **complete** — Implementation Phase 1 (Foundation) started  

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

Preferred deployment is **inside the corporate firewall / private VPC**. **Phase 1 implements on Google Cloud.**

## Current status

| Phase | Status |
|-------|--------|
| Ideation / problem framing | Done (migrated from `ideas`) |
| Requirements baseline | Captured under `docs/` |
| Architecture | **Complete** (2026-08-14) — [closure report](docs/phase-closure/architecture-phase.md) |
| Implementation | **Phase 1 in progress** — [roadmap](docs/implementation-roadmap.md) · [Phase 1 plan](docs/phases/phase-1.md) |

Living architecture: [docs/architecture.md](docs/architecture.md). Deferrals: [docs/backlog.md](docs/backlog.md).

## Application (local development)

The first service is `@ellmgw/gateway` under `apps/gateway/`. Requires **Node.js 22** (`.nvmrc`) and **pnpm**.

```bash
pnpm install
pnpm test
pnpm --filter @ellmgw/gateway dev
curl -sS http://127.0.0.1:8080/health
```

See [apps/gateway/README.md](apps/gateway/README.md). **1.3 OIDC:** `GET /health` is public; `GET /v1/me` requires a Google ID token. No Grok adapter or Cloud Run deploy yet.

## Infrastructure (ellmgw-dev)

GCP foundation is Terraform under [infra/terraform/](infra/terraform/). Project `ellmgw-dev`, region `asia-south1`, state `gs://ellmgw-dev-tfstate/gateway/dev`.

```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Secret **values** are not in Terraform. Add versions out of band — see [infra/terraform/README.md](infra/terraform/README.md).

## Architecture Decision Records

All of the following are **Accepted**.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](docs/adr/001-conversation-memory-storage.md) | Conversation Memory Storage | Accepted |
| [ADR-002](docs/adr/002-policy-engine.md) | Policy Engine (OPA) | Accepted |
| [ADR-003](docs/adr/003-input-guardrails-dlp.md) | Input Guardrails / DLP | Accepted |
| [ADR-004](docs/adr/004-routing-and-adapters.md) | Routing Engine + Provider Adapters | Accepted |
| [ADR-005](docs/adr/005-semantic-cache.md) | Semantic Cache | Accepted |
| [ADR-006](docs/adr/006-metering-and-feedback.md) | Metering & Feedback | Accepted |
| [ADR-007](docs/adr/007-observability.md) | Observability | Accepted |
| [ADR-008](docs/adr/008-authentication-sso.md) | Authentication & SSO | Accepted |
| [ADR-009](docs/adr/009-deployment-topology.md) | Deployment Topology & HA | Accepted |
| [ADR-010](docs/adr/010-admin-console.md) | Admin Console (UI-first) | Accepted |

The Threat Model lives in [architecture.md §14](docs/architecture.md#14-threat-model). It maps risks to these ADRs and is **not** a separate ADR.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/overview.md](docs/overview.md) | Problem statement, vision, KPIs |
| [docs/requirements.md](docs/requirements.md) | Functional & non-functional requirements |
| [docs/use-cases.md](docs/use-cases.md) | Personas and scenarios |
| [docs/architecture.md](docs/architecture.md) | **Living architecture** (locked through threat model) |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Testing strategy (suites, phase-exit evidence, deploy smoke) |
| [docs/implementation-roadmap.md](docs/implementation-roadmap.md) | Implementation roadmap (Phases 1–6) |
| [docs/phases/phase-1.md](docs/phases/phase-1.md) | Phase 1 Foundation — sub-phases 1.1–1.8 |
| [docs/ui-spec.md](docs/ui-spec.md) | Admin Console UI specification (prerequisite for Phase 5 UI) |
| [docs/open-questions.md](docs/open-questions.md) | Remaining product / technical questions |
| [docs/backlog.md](docs/backlog.md) | Deferrals carried into Implementation |
| [docs/phase-closure/architecture-phase.md](docs/phase-closure/architecture-phase.md) | Architecture phase closure record |
| [docs/adr/](docs/adr/) | Architecture Decision Records (001–010) |
| [design/](design/) | Working design notes and diagrams (as they land) |

## Repository layout

```text
.
├── README.md
├── package.json            # pnpm workspace root
├── pnpm-workspace.yaml
├── apps/
│   └── gateway/            # @ellmgw/gateway (Phase 1 skeleton)
├── infra/terraform/        # GCP foundation (ellmgw-dev)
├── design/                 # Working design artefacts
└── docs/
    ├── architecture.md
    ├── requirements.md
    ├── overview.md
    ├── use-cases.md
    ├── open-questions.md
    ├── backlog.md
    ├── testing-strategy.md
    ├── implementation-roadmap.md
    ├── ui-spec.md
    ├── phases/
    │   └── phase-1.md
    ├── phase-closure/
    │   └── architecture-phase.md
    ├── assets/
    │   ├── logical-component-diagram.jpg
    │   ├── deployment-topology-overview.jpg
    │   ├── deployment-topology-gcp-phase1.svg
    │   └── ui/                 # Admin Console reference mockups
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
