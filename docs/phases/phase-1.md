# Phase 1 — Foundation

> **Status:** Sub-phases **locked**; execution has not started  
> **Last updated:** 2026-08-16  
> **Parent:** [Implementation roadmap](../implementation-roadmap.md)  
> **Testing:** [Testing strategy](../testing-strategy.md) — every sub-phase; recorded evidence at phase exit  
> **Architecture:** ADR-008 (authn), ADR-007 (observability), ADR-009 (GCP / Cloud Run)

Detailed design for each sub-phase is written **when that sub-phase starts**. This document is the sequencing contract, not the execution prompt.

---

## 1. Goal

A **deployable skeleton** on Google Cloud: a human can sign in with Google, call an **OpenAI-compatible** chat completions surface, and receive a **Grok** completion through a Gateway adapter — with secrets, fail-closed auth, and privacy-preserving logs.

---

## 2. Locked decisions (Phase 1)

| Concern | Choice |
|---------|--------|
| First provider | **Grok** (xAI) |
| API shape | **OpenAI-compatible** (`/v1/chat/completions` style) from day one |
| Compute | **Cloud Run first**; GKE only if Cloud Run is insufficient |
| Identity | **Google OIDC** for human users; unauthenticated traffic **fail-closed** |
| Secrets | **Secret Manager** + Workload Identity (no keys in the image or repo) |
| Observability | Structured logs + basic health/metrics; **no raw prompts** |
| Downstream tokens | Internal request context after validation; adapters do not parse Google tokens |

These refine the roadmap’s Phase 1 envelope. They do not reopen later phases (OPA, DLP, multi-provider matrix, Admin UI).

---

## 3. Sub-phases

| ID | Name | Outcome |
|----|------|---------|
| **1.1** | Repo & service skeleton | Language/toolchain, app module layout, health endpoint, CI that runs unit tests. No live GCP required. |
| **1.2** | GCP foundation & secrets | Project APIs, service account, Workload Identity, Secret Manager placeholders (provider key, OIDC client). Idempotent infra scripts. |
| **1.3** | Google OIDC authentication | Authorization Code (+ PKCE as needed); token validation; internal request context; unauthenticated → 401. |
| **1.4** | Minimal request path | OpenAI-compatible `/v1/chat/completions` (and models list if trivial). Auth required. May still stub the model until 1.5. |
| **1.5** | First provider adapter — Grok | Adapter implements the common interface enough to stream or return a Grok chat completion. Provider key from Secret Manager. |
| **1.6** | Minimal observability | Structured JSON logs (allow-listed fields), `/health`, basic RED or request-count metric. No prompt/response bodies. |
| **1.7** | Cloud Run deploy | Service deployed in a non-prod (or designated) GCP project/region; HTTPS URL; smoke against the live URL. |
| **1.8** | Phase 1 exit pack | Recorded smoke + unit evidence; README/status hygiene; phase-exit note. Coordinator validates evidence. |

Sub-phases are sequential in **dependency** (1.5 needs 1.4; 1.7 needs 1.2–1.6). 1.6 may start as soon as 1.1 exists.

---

## 4. Phase exit criteria

Phase 1 is complete only when **all** of the following are true **and recorded**:

- [ ] Service is **deployed on Google Cloud Run** (URL from `status.url`, not a hardcoded guess)
- [ ] **Google OIDC** works for an allow-listed admin/test user
- [ ] Unauthenticated requests are **rejected** (fail-closed); no provider call
- [ ] Authenticated `POST /v1/chat/completions` **reaches Grok** via the adapter and returns a completion (stream or JSON)
- [ ] Provider and OIDC secrets come from **Secret Manager** (or equivalent); nothing committed
- [ ] Structured logs + health/metrics exist; **CI/logs contain no raw prompts**
- [ ] **Smoke** evidence recorded (command/CI link, date, who ran it)
- [ ] Phase-closure hygiene: status in README/roadmap; this file marked complete when 1.8 lands

A merge to `main` without that evidence is **not** Phase 1 done.

---

## 5. Non-goals (Phase 1)

| Out | Why |
|-----|-----|
| OPA / purpose catalogue / policy snapshots | Phase 2 |
| Input Guardrails / DLP | Phase 2 |
| Semantic cache, conversation memory | Phase 4 |
| Admin Console UI | Phase 5 (after [UI spec](../ui-spec.md)) |
| Multi-provider routing matrix, ordered lists, fallback | Phase 3 |
| BigQuery metering / star feedback | Phase 5 |
| GKE | Only if Cloud Run cannot host the skeleton |
| Agent / client-credentials identity | Backlog B1 |
| Private DC | Backlog B2 |
| Production HA soak, rate-limit productisation | Phase 6 |

A hard-coded “allow all authenticated users to Grok” is acceptable in Phase 1. It is **not** a substitute for Policy later.

---

## 6. Test expectations

Follow [testing-strategy.md](../testing-strategy.md) Foundation row:

- **Every sub-phase:** unit/component tests for new code in the same PR
- **1.3–1.5:** integration tests with fakes/recorded contracts (no live Grok required to merge)
- **1.7–1.8:** **Smoke** against the Cloud Run URL (live Grok allowed only with secrets, never logged)
- Security/guardrail for this phase: unauthenticated 401; no prompt bodies in log fixtures
- Performance pack is **not** a Phase 1 exit gate

---

## 7. Next

Open **1.1 Repo & service skeleton** with a short design note (language, module layout, CI), then execute. Do not skip to Cloud Run or Grok before 1.1–1.4 exist.
