# ADR-004: Routing Engine and Provider Adapters Design

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-25 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | routing, adapters, fallback, circuit-breaker, rate-limits, agents, model-discovery |

## Context

After policy allows a request and DLP has redacted or cleared the text, the Gateway must **select a destination** and **invoke a provider** without hard-coding vendor SDKs into the data plane.

Requirements that shape routing and adapters:

- Admins need **flexible, policy-aligned selection** among multiple allowed models per purpose — not a single hard-wired model.
- Selection must follow an **admin-defined ordered preference**, not opaque “magic” ranking on the hot path.
- Interactive UX cannot tolerate long retry storms; **short, capped** retries only.
- Providers and models go unhealthy; the system needs **circuit breaking** so traffic fails over predictably.
- **Observability and metering** must look the same across Claude, Grok, Gemini, OpenAI, internal LLMs, and RAG.
- Every response must make it obvious **which model and sub-model** answered (transparency and trust).
- **Agents** are first-class consumers but high-risk: they can burn tokens and spam endpoints without human pacing.
- Model catalogues change frequently; discovery must stay fresh without forcing code deploys.

## Decision

| Concern | Choice |
|---------|--------|
| Model preference | Admin defines an **ordered list of models per purpose**; Routing Engine walks that order |
| No match / exhausted list | Fall back to models bound to the mandatory **`General`** purpose |
| Retries on current model | **Short, capped exponential backoff** before advancing (illustrative: ~200 ms → 500 ms → 1 s; total extra delay budget ~**1.5–2 s**) |
| Unhealthy models | **Circuit breaking** — open circuit skips model until half-open probe succeeds |
| Provider integration | **Common Provider Adapter interface** for all destinations (public LLM, internal LLM, RAG) |
| Response transparency | **Mandatory** attribution: parent model + sub-model/variant on every response |
| Model discovery | **Periodic background sync** (admin-configurable interval) + **manual refresh** for Super AI Users |
| Agents | First-class, **high-risk** principals: stronger rate limits, quotas, and abuse controls |
| Abuse / capacity | Admin-set rate limits and quotas **per user, per agent, per purpose**; throttle or **hard-block** abusive behaviour |
| Adapter duties | Request formatting, streaming, conversation history handoff, uniform response metadata and errors |

### Routing sketch

1. Receive allowed purpose, principal type (user / Super AI User / agent), and any Super-user allowlisted override from Policy.
2. Resolve ordered candidate list: purpose models → if empty or all failed → **`General`** models (unless policy already denied egress).
3. Skip candidates with open circuit or exhausted quota.
4. For each candidate: attempt call via adapter; on transient failure, short capped retries; then next candidate.
5. On success: stream response; attach model + sub-model metadata for client and metering.
6. On total failure: return a clear gateway error (no silent partial success).

## Consequences

### Positive

- **Predictable routing**: admins see the same order the engine will try.
- **Resilience without long waits**: short retries + ordered fallback + circuit breakers.
- **Easier multi-provider growth**: new vendor = new adapter implementing the common interface.
- **Honest UX**: users always know which model answered.
- **Safer agents**: quotas and rate limits reduce runaway cost and load.
- Uniform logging, metering, and error shapes across the estate.

### Negative / trade-offs

- Operational overhead to maintain **ordered lists**, circuit thresholds, and rate-limit matrices.
- Fallback to `General` can surprise users if purpose-specific quality differs — mitigate with good admin defaults and attribution.
- Adapter abstraction has a design cost (streaming edge cases, vendor quirks).
- Manual discovery refresh for Super AI Users needs authz and audit so it is not a free DoS against provider catalogue APIs.

### Neutral

- Semantic cache remains upstream/alongside routing; cache hits may skip provider calls entirely.
- Exact circuit thresholds and retry numbers are tunable; the **capped short-retry** and **ordered list** principles are locked.
- Internal RAG uses the same adapter contract with RAG-specific methods (e.g. citations) mapped into uniform metadata.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Single model per purpose | Too brittle when one provider rates-limits or degrades |
| Unbounded retries / long backoff | Destroys interactive latency budget |
| Provider-specific code paths without a common interface | Inconsistent metering, errors, and streaming behaviour |
| No model attribution | Violates product requirement (F19) and user trust |
| Agents treated like normal users only | Under-controls token-hungry automation |
| Discovery only at deploy time | Catalogue goes stale as providers ship new variants |

## Related

- [Architecture §6 — Routing Engine](../architecture.md#6-routing-engine)
- [Architecture §7 — Provider Adapters](../architecture.md#7-provider-adapters--llm-integration-layer)
- Requirements: F1, F2, F7, F17, F19, F20, F21
- [ADR-002: Policy Engine](002-policy-engine.md) — purpose, allowlists, `General`
- [ADR-001: Conversation Memory](001-conversation-memory-storage.md) — history assembly for adapters
