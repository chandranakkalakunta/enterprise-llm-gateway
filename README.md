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

Living architecture: [docs/architecture.md](docs/architecture.md).

## Documentation

| Document | Description |
|----------|-------------|
| [docs/overview.md](docs/overview.md) | Problem statement, vision, KPIs |
| [docs/requirements.md](docs/requirements.md) | Functional & non-functional requirements |
| [docs/use-cases.md](docs/use-cases.md) | Personas and scenarios |
| [docs/architecture.md](docs/architecture.md) | **Living architecture** (system context, components, locked decisions through routing/adapters) |
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
    ├── assets/             # Diagrams and images
    └── adr/
        ├── 001-conversation-memory-storage.md
        ├── 002-policy-engine.md
        ├── 003-input-guardrails-dlp.md
        └── 004-routing-and-adapters.md
```

## One-sentence summary

A governance-first, customer-controlled LLM control plane that unifies multi-provider routing, purpose-based policy, DLP, internal RAG, conversation memory, and privacy-respecting analytics — private deployment first.

---

*Initialized from the `ideas/enterprise-llm-gateway` workspace into this dedicated repository.*
