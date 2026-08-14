# Overview

## Problem Statement

Enterprises are adopting generative AI at speed, but most rollouts quickly concentrate on one or two public LLM vendors. That concentration is rarely a pure product choice. It is driven by security reviews, compliance and data-residency constraints, cost predictability, procurement lock-in, and the high cost of rewiring applications when a provider changes terms, models, or pricing.

Meanwhile the model landscape moves every few months: capability rankings shift, prices drop, context windows expand, and new modalities appear. What looked like a stable platform decision becomes a **strategic risk**. Switching later is expensive because every team has hard-coded provider SDKs, prompts, auth patterns, and informal “just use ChatGPT” habits that bypass corporate control.

The result is a painful tension:

- **Security / legal** wants data to stay inside the trust boundary unless explicitly approved.
- **Engineering and knowledge workers** want the best model for the job (coding, realtime chat, image, deep research, internal Q&A).
- **Finance** wants predictable spend and the ability to rebalance traffic when a vendor raises prices.
- **Leadership** wants AI adoption without betting the company on a single external dependency.

Today there is no clean, customer-controlled control plane that unifies **multi-provider routing**, **purpose-based policy**, **strong input guardrails / DLP**, **internal RAG and internal LLMs as first-class destinations**, **role-aware overrides**, and **privacy-respecting usage analytics** — without forcing the enterprise onto a pure multi-tenant public SaaS path they may not trust.

## Desired Outcome / Success Vision

When the **Enterprise LLM Gateway** is successful:

- Every employee AI request (chat UI, IDE plugin, internal app, batch job) goes through a single **customer-controlled control plane**.
- Corporate admins define **purpose → route** mappings (e.g. coding → Claude, realtime → Grok, image → Gemini, internal knowledge → internal RAG / internal LLM).
- **Normal AI Users** automatically follow corporate policy; **Super AI Users** can override within clearly defined limits.
- Corporate IP and sensitive data are **blocked or redacted** before they leave the trust boundary unless policy explicitly allows it.
- Internal knowledge queries stay on **enterprise RAG** and never need a public LLM.
- Customer-hosted open-source and internal models are **equal peers** to public providers in the routing graph.
- A **semantic cache** reduces cost and latency for repeated / near-duplicate work.
- Usage is metered and analysed in a **privacy-respecting** way (aggregate, purpose-based, role-based — not surveillance of free-form prompts by default).
- Optional **1–5 star user feedback** on responses is collected and fed into analytics so routing quality improves over time (ratings link to request metadata, not raw prompts by default).
- The gateway adds **minimal latency**, supports **full streaming**, and does not become a throughput bottleneck.
- Preferred deployment is **inside the corporate firewall / private VPC**; a dedicated private cloud instance is acceptable. Pure multi-tenant public SaaS is not the primary offer. **Phase 1 implements on Google Cloud** (customer VPC). Private Data Center is a documented future target, not a Phase 1 build.

## How this differs from typical public LLM gateways

Public LLM gateways and proxies are often built for developer convenience, multi-provider access, and cost/latency optimisation. The Enterprise LLM Gateway prioritises **governance, trust-boundary control, and enterprise roles** — with multi-provider routing as a means, not the product’s only end.

| Capability                              | Typical Public Gateway | Enterprise LLM Gateway                 |
|-----------------------------------------|------------------------|----------------------------------------|
| Multi-LLM routing                       | Yes                    | Yes                                    |
| Cost / latency optimization             | Strong focus           | Secondary                              |
| Corporate policy engine                 | Weak or absent         | Core capability                        |
| Purpose → Model mapping                 | Rare                   | Explicit (admin-defined)               |
| Normal vs Super AI User roles           | Rare                   | Explicit                               |
| Strong input guardrails / DLP           | Usually weak           | Critical requirement                   |
| Routing to internal RAG / internal LLMs | Rare                   | First-class                            |
| Semantic cache                          | Sometimes              | Required                               |
| Privacy-respecting metering & analytics | Limited                | Explicit goal                          |
| Preferred deployment                    | Multi-tenant public    | Private VPC / corporate firewall first |
| User feedback (1–5 stars)               | Rare                   | Supported and fed into analytics       |

## Why Now?

- Enterprises have moved from AI pilots to mandatory productivity tools; shadow AI is already happening and is hard to govern after the fact.
- Model switching cost is rising as more production systems depend on specific providers, while capability and price rankings continue to churn.
- Regulators and boards are asking harder questions about where prompts go, who can see them, and how data residency is enforced.
- Internal RAG platforms and private / open-source model hosting are mature enough to be real routing destinations, not demos.
- Latency-sensitive streaming UX is now table stakes; a gateway that cannot stream or that adds large fixed overhead will be rejected by users.
- Existing “AI gateway / proxy” products often optimise for developer DX or multi-tenant SaaS, not for **governance-first, customer-controlled, private deployment** with internal RAG as a first-class route.

## High-level Approach

A **policy-driven control plane** sits between all enterprise AI clients and all model destinations (public LLMs, customer-hosted / internal LLMs, and the enterprise internal RAG engine).

Rough request path:

1. Authenticate the user via **Google OIDC / OAuth 2.0** (v1; human users) and resolve role (**Normal** vs **Super AI User**) via static mapping (RBAC later). Unauthenticated requests are rejected.
2. Classify or accept the **purpose** of the request (explicit purpose, client-declared, or policy-inferred).
3. Run **input guardrails / DLP** (detect, redact, or block sensitive content according to policy).
4. Check **semantic cache** for a safe, policy-compatible hit.
5. **Route** to the configured destination: public provider, internal LLM, or internal RAG.
6. Stream the response back; apply output policies if required.
7. Record **privacy-respecting metering** and audit events (purpose, route, tokens, latency, policy decisions — not raw prompts by default).
8. Optionally accept a **1–5 star rating** after the response; low scores (especially 1-star) become strong negative signals in analytics, linked to request metadata only unless richer retention is explicitly allowed.

Personal preferences (e.g. preferred model within an allowed set) apply only inside the envelope defined by corporate policy.

## Success Metrics (KPIs)

| Metric | Target (early / directional) | How Measured |
|--------|------------------------------|--------------|
| % of enterprise AI traffic that flows through the gateway | ≥ 80% of known AI clients within 6 months of org rollout | Gateway request volume vs inventory of approved AI clients |
| Policy compliance rate (requests that obey purpose → route without violation) | ≥ 95% | Policy engine decisions + audit log |
| % of internal-knowledge traffic kept on internal RAG / internal LLM | ≥ 90% of classified internal-knowledge purposes | Purpose tags + route outcomes |
| Cost savings vs direct single-vendor usage (or vs uncached traffic) | Measurable reduction (cache hit rate + cheaper routes) | Metering + provider invoices |
| Semantic cache hit rate (where eligible) | Target set per tenant after baseline | Cache metrics |
| Added latency overhead (p50, non-cache path, excluding provider time) | **&lt; 30 ms typical** | Distributed tracing |
| Streaming time-to-first-token overhead | Negligible vs direct provider (no buffering of full response) | Client + gateway traces |
| Super-user override usage within policy | Tracked; out-of-bounds overrides = 0 | Audit log |
| Security incidents from unapproved prompt leakage via gateway path | 0 | Security / DLP incident process |
| Optional response ratings (1–5 stars) collected and used to improve routing quality over time | Growing participation; low-star (esp. 1★) rate actionable by purpose/model | Analytics store (metadata-linked, privacy-preserving) |

## Out of Scope (initial version)

- Building a full general-purpose chat product UI (the gateway serves clients; a reference chat UI may come later).
- Training or fine-tuning foundation models.
- Replacing the enterprise’s existing IdP, SIEM, or data-loss-prevention platform (integrate, do not reinvent).
- Guaranteeing perfect DLP (best-effort + strong defaults; absolute certainty is not claimed).
- Pure multi-tenant public SaaS as the primary commercial model for v1.
- Automated legal advice or contractual negotiation with model providers.
- Being the system of record for long-term prompt archives by default (opt-in retention only, under policy).

---

*Migrated from the ideas repository.*
