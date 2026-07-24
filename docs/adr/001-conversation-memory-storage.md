# ADR-001: Conversation Memory Storage

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-24 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | conversation-memory, storage, redis, postgres, object-storage |

## Context

The Gateway must support multi-turn conversations (F16) with **strict isolation** so no user can see another user’s prompts or history. Conversations need:

- Low-latency access on the hot path when assembling model context
- Durable history across process restarts and Redis eviction
- Safe handling of file/image attachments without bloating message stores
- Bounded context windows as threads grow long
- Privacy-aligned defaults (noise reduction, no free-form surveillance)

A single store does not meet all of these well: pure Redis is fast but not authoritative durability; pure Postgres is durable but weaker for hot multi-turn assembly at scale; embedding large attachments in either is costly and awkward.

## Decision

Use a **hybrid conversation memory** architecture:

| Concern | Choice |
|---------|--------|
| Hot / active context | **Redis** |
| Durable thread history & metadata | **Managed PostgreSQL** |
| Attachments (files, images, binaries) | **Object storage** |
| Unit of memory | **Conversation (thread)** |
| Isolation key | **`user_id` + `conversation_id`** |
| Long threads | **Smart summarisation** of older turns |
| Content philosophy | **Noise reduction from day one** — high-signal turns, not raw dump of every system event |

## Consequences

### Positive

- Hot path stays low-latency for multi-turn context assembly.
- Durable store supports retention policy, recovery, and admin/compliance needs without depending on Redis alone.
- Attachments scale independently; message rows hold references, not blobs.
- Clear isolation keys make ACL mistakes harder and auditable.
- Summarisation keeps token cost and model quality under control as threads grow.

### Negative / trade-offs

- Operational complexity: two datastores + object storage, consistency rules, and rehydration logic.
- Must define explicit write-through / write-behind behaviour so Redis and Postgres do not diverge silently.
- Summarisation quality and thresholds need product + engineering tuning over time.
- Managed Postgres and object storage must remain inside the customer trust boundary (VPC / private deploy).

### Neutral

- Provider Adapters and Semantic Cache remain separate; conversation memory is not a substitute for the semantic cache.
- Exact TTL, retention, and redaction policies remain configurable and may get follow-up ADRs.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Redis only | Insufficient durable authority and recovery story for enterprise history |
| Postgres only | Acceptable durability; weaker hot-path latency and session-scale write patterns without careful caching anyway |
| Provider-side memory only | Loses customer control, isolation guarantees, and private-deployment posture |
| Full raw archive of every token by default | Conflicts with privacy-respecting defaults and noise-reduction goals |

## Related

- [Architecture §3 — Conversation Memory](../architecture.md#3-conversation-memory-locked-decisions)
- Requirements: F15 (isolation), F16 (conversation memory)
