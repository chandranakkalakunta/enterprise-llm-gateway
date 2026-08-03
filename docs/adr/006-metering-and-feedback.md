# ADR-006: Metering & Feedback Storage and Granularity

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-08-03 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | metering, analytics, feedback, privacy, aggregation, chargeback, clickhouse |

## Context

Enterprises need **usage visibility** and **quality signals** without turning the Gateway into a free-form surveillance store of employee prompts. Metering must support:

- Token and cost insight by user, department, purpose, and model
- **Chargeback / showback** to cost centres
- Cache effectiveness and Agent vs human load
- Optional **1–5 star** feedback that improves routing and model quality analysis over time

Constraints that shape the decision:

- **Per-request full-fidelity retention forever** explodes in volume and amplifies privacy risk.
- The product’s private-first posture should apply to analytics **where practical**: prefer stores inside (or tightly peered with) the customer VPC.
- Feedback is only useful if it joins **rich request metadata**; it must not require raw prompt/response bodies by default.
- Interactive rate limiting and live dashboards need **hot, finer-grained counters**; long-term reporting does not.

## Decision

| Concern | Choice |
|---------|--------|
| Long-term store | **Analytical database / warehouse** that preferably runs **inside** (or tightly peered with) the customer VPC. **ClickHouse** is a strong candidate. |
| External SaaS warehouse | Only for **clean aggregates**, and only when the customer **explicitly opts in** |
| Long-term granularity | Prefer **aggregated** data; avoid permanent retention of every individual request |
| Hot / short-term | Finer-grained counters for live dashboards and **rate limiting** (separate from long-term warehouse grain) |
| Feedback | **1–5 star** ratings with rich metadata (model, purpose, latency, cache hit, role, etc.); **no raw prompts/responses by default** |
| Privacy default | Do **not** store raw prompts or full conversation content in the metering store |
| Low scores | Especially **1-star** → recorded as **strong negative signals** for routing / quality analysis |
| Economics | Design explicitly supports **chargeback** and **showback** |
| v1 report views | Per-user, per-department, per-purpose token consumption; cost estimates; model usage distribution; cache hit rate; feedback scores by model + purpose; Agent vs human usage split |

### Pipeline sketch

1. Data plane emits **async metering events** (metadata only) after policy/DLP/route/cache outcomes — never on the streaming critical path.
2. Hot path aggregators / counters serve quotas, rate limits, and near-real-time ops views.
3. Roll-up jobs write **aggregates** (and optional short-lived detail windows) into the analytical store.
4. Clients POST optional star ratings keyed by `request_id` (or equivalent); store joins rating to **metadata**, not bodies.
5. Dashboards and chargeback exports read aggregates; investigation modes that need richer content remain out-of-band under explicit retention policy (not the metering default).

## Consequences

### Positive

- **Analytical power** without forcing all raw traffic into a warehouse.
- **Stronger privacy posture**: metering is not a prompt archive.
- Fits **chargeback/showback** and model-quality loops (including strong-negative 1-star signals).
- **ClickHouse-class** stores match high-ingest, aggregation-heavy analytics workloads well when run privately.
- Clear split between **hot counters** (control plane) and **cold aggregates** (finance / CoE reporting).

### Negative / trade-offs

- Requires a deliberate **aggregation pipeline** (correct windows, late events, idempotency).
- Private analytical store adds **operational** surface (capacity, backups, access control).
- Losing permanent per-request rows limits some forensic “what exactly was asked?” workflows — by design; those belong to policy-governed audit/retention paths, not default metering.
- Exact ClickHouse vs peer product choice may still be validated in implementation; the **private-friendly analytical store + aggregate grain** principles are locked.

### Neutral

- Audit Log remains separate (decisions, overrides, blocks); metering optimises for usage and quality analytics.
- Conversation Memory remains the place for multi-turn UX content under isolation keys — not the analytics warehouse.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Permanent full per-request warehouse | Volume and privacy cost too high for default posture |
| Fully external SaaS analytics as default | Conflicts with private-first; only opt-in for clean aggregates |
| Store raw prompts with every meter event | Violates privacy-respecting metering goals (F9) and employee trust |
| Metrics-only (no analytical store) | Insufficient for chargeback, multi-dimensional CoE reporting, and historical quality analysis |
| Feedback without metadata join | Ratings become anecdotal; cannot drive purpose × model improvement |

## Related

- [Architecture §9 — Metering & Feedback](../architecture.md#9-metering--feedback)
- Requirements: F9, F10; analytics & logging requirements
- [ADR-004: Routing and Adapters](004-routing-and-adapters.md) — model attribution fields
- [ADR-005: Semantic Cache](005-semantic-cache.md) — cache_hit signals
