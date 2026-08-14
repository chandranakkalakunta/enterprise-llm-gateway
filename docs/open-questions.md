# 05 – Open Questions & Risks

## Open Questions

| # | Question | Owner | Status | Resolution / Notes |
|---|----------|-------|--------|--------------------|
| 1 | **Which DLP techniques** are accurate enough (secrets, PII, source code IP markers) **without destroying utility** for developers who paste real code and logs? | Security + Eng | Open | Need precision/recall targets and allowlist patterns for common dev workflows |
| 2 | How should **semantic cache invalidation** work (time TTL, policy version, embedding drift, explicit purge), and how do we guarantee **no cross-ACL / cross-purpose privacy leaks**? | Eng + Security | Open | Spike on tenancy model and similarity thresholds |
| 3 | How aggressively should policy **push internal RAG vs external models** for ambiguous queries (e.g. “how do we handle refunds?” that might be public knowledge or internal policy)? | Product + AI CoE | Open | Default-internal vs classify-then-route |
| 4 | What is the **pricing / packaging model** for the gateway itself (per seat, per token processed, platform fee, support tiers) given that model spend stays with providers? | Business | Open | Must remain small vs model bill or buyers reject the hop |
| 5 | Do target customers require **multi-region active-active** for the control plane in v1, or is single-region HA + DR enough? | Product + Platform | Open | Active-active complicates policy consistency and cache |
| 6 | What are the **legal / contractual implications** of sitting in the middle of LLM traffic (DPAs, sub-processors, logging, discovery, customer audit rights)? | Legal | Open | Especially for private deployment vs any hosted option |
| 7 | Exact **provider set and adapter priority** for v1 (Claude, Grok, Gemini, OpenAI, Azure OpenAI, Bedrock, Vertex, …)? | Product + Eng | Open | Start with highest enterprise demand + OpenAI-compatible escape hatch |
| 8 | Should purpose be **client-declared only**, or do we invest in **automatic purpose classification** early? | Product | Open | Auto-class adds error modes; declared is simpler and auditable |
| 9 | How much **raw prompt retention** do security teams demand for forensics vs privacy commitments to employees? | Security + Legal + HR | Open | Tension between investigation and trust |
| 10 | Reference **client surface** for v1: OpenAI-compatible proxy only, plus which IDE/chat integrations? | Product | Open | DX drives adoption |
| 11 | Super AI User **governance**: who can grant the role, time-bounded grants, dual control? | Security + Admin | Open | v1 uses **static IdP-group mapping** ([ADR-008](adr/008-authentication-sso.md)); RBAC, time-boxed grants, and dual control remain future. Avoid permanent standing privilege sprawl |
| 12 | Can we meet **&lt; 30 ms p50 overhead** with on-path DLP + embeddings in the same region as clients? | Eng | Open | May need staged DLP (fast rules first, deep scan async for non-egress) |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gateway becomes a latency or availability bottleneck → users bypass it | Medium | Critical | Thin data plane, horizontal scale, streaming-first, clear SLOs, failovers; make bypass hard via network policy + approved clients only |
| DLP too noisy → users revolt or find workarounds | High | High | Tunable policies, purpose-specific rules, developer-friendly explanations, Super-user paths with audit, continuous false-positive review |
| DLP too weak → sensitive data still leaves | Medium | Critical | Fail-closed egress, layered detectors, optional enterprise DLP integration, red-team tests |
| Semantic cache serves wrong or sensitive answer across contexts | Medium | Critical | Strict scope keys (tenant, purpose, ACL, policy version); high similarity threshold; disable cache on sensitive purposes |
| Single-vendor thinking creeps into product (“we’re an OpenAI proxy”) | Medium | Medium | First-class internal RAG + internal LLM in demos, docs, and default policies |
| Legal challenge to intercepting / logging AI traffic | Low–Medium | High | Private deployment, minimal retention defaults, transparent employee notice, DPAs reviewed early |
| Scope creep into full chat suite or full RAG product | Medium | Medium | Strict non-goals; integrate, don’t rebuild corpora or foundation models |
| Provider API churn breaks adapters | High | Medium | Adapter isolation, contract tests, canary per provider |
| Super-user role becomes de-facto ungoverned power | Medium | High | Allowlists, time-boxed grants, mandatory audit, periodic access review |

## Assumptions That Need Validation

- Enterprises will accept (and network-enforce) a mandatory hop if latency and reliability are excellent.
- Corporate admins can maintain purpose → model maps without constant engineering help.
- Internal RAG APIs are stable enough to treat as production routes.
- Privacy-respecting metering (without default prompt bodies) still satisfies security and FinOps stakeholders.
- OpenAI-compatible `base_url` redirection covers a large enough fraction of client apps for v1 adoption.
- Private VPC deployment is operable by typical platform teams (Helm/K8s or equivalent).

## Research / Spikes Needed

- [ ] **DLP spike**: evaluate regex + ML detectors on real-looking dev prompts; measure false positive rate on code paste and stack traces
- [ ] **Semantic cache spike**: embedding model choice, ANN library, isolation model, hit-rate vs threshold curves, invalidation design
- [ ] **Latency budget prototype**: policy + DLP + cache miss path under load; prove &lt; 30 ms p50 overhead in-region
- [ ] **Streaming adapter matrix**: Claude / Grok / Gemini / OpenAI-compatible internal model — TTFT and disconnect behaviour
- [ ] **Internal RAG adapter PoC** against one reference RAG API (retrieve + answer + citations)
- [ ] **Legal memo**: gateway as traffic intermediary; logging; private deployment vs hosted; employee monitoring concerns
- [ ] **Packaging research**: interviews with 3–5 platform/AI CoE buyers on willingness to pay for governance hop
- [ ] **Threat model workshop**: insider Super user, cache leakage, provider key theft, prompt injection via tools
- [ ] **Competitive teardown**: existing AI gateways / LLM proxies / enterprise AI control planes — gaps vs this design
