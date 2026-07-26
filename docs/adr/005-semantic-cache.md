# ADR-005: Semantic Cache Design

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-26 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | semantic-cache, vector-db, embeddings, cosine, ttl, privacy |

## Context

Repeated and near-duplicate prompts are common in enterprise traffic (FAQs, agent loops, “same question, slightly rephrased”). A semantic cache can cut **cost**, **latency**, and **provider load** when a safe prior answer exists.

Constraints that shape the design:

- The cache must **never** become a cross-user or cross-purpose leak channel for private or sensitive text.
- Calling a **public** embedding or ranking model for cache would expand the trust-boundary problem (same class of risk as public LLM DLP).
- **Full multi-turn thread** caching is low value (threads diverge) and high risk (large personal context blobs).
- Even **modest** hit rates matter at enterprise scale and for token-hungry **Agents**.
- Cache must **respect Policy and DLP** on both read and write — it is an optimization, not a bypass.

## Decision

| Concern | Choice |
|---------|--------|
| Vector store | **Dedicated Vector Database** (mandatory; not optional “embed in Postgres later”) |
| Embeddings | **Local / private open model** inside the trust boundary; **bge** or **nomic** family preferred |
| Similarity | **Cosine similarity** |
| Threshold | Configurable; initial range ~**0.88–0.90**; **tunable per purpose** |
| Sharing | Only for **non-sensitive / DLP-clean** content; **never** cache private or redacted data |
| Primary unit (v1) | **Per-prompt**: normalized prompt + purpose + sensitivity (not full multi-turn threads) |
| Isolation / scoping | At least **purpose + sensitivity level** (optionally department) |
| Invalidation | Configurable **TTL** + **manual admin** invalidation + **source-document** invalidation for RAG-related entries |
| Eviction | **Size-based** (max entries or max storage) with **LRU** (or equivalent) |
| Hit-rate goal | Treat as measurable optimization; target meaningful enterprise rates (**8%+** as a directional target) |
| Policy / DLP | Must respect Policy and DLP **before** any cache write or any cache hit is served externally |

### Read / write sketch

1. Policy allows request; purpose and cache eligibility flags resolved.
2. DLP runs; result classifies sensitivity / clean vs redacted vs block.
3. If not cache-eligible (sensitive, redacted, blocked, purpose disables cache) → skip cache; continue to route.
4. Else embed normalized prompt (in-boundary model) → cosine ANN search in Vector DB under scope keys.
5. Hit above purpose threshold → serve cached response (with attribution that it was a cache hit + original model metadata if stored).
6. Miss → route to provider; on success, **async** write only if still DLP-clean and policy allows.

## Consequences

### Positive

- **Meaningful savings** when hit rate is healthy (cost, latency, provider pressure).
- **Clear privacy boundary**: no shared cache of secrets, redactions, or private threads.
- **Tunable**: threshold and TTL per purpose with real traffic feedback.
- Embeddings stay **inside the VPC** — consistent with private-deployment-first posture.
- Dedicated Vector DB keeps ANN quality and ops separate from Conversation Memory Redis/Postgres.

### Negative / trade-offs

- **Extra infrastructure**: Vector DB + embedding service to run, secure, and capacity-plan.
- False-positive semantic hits remain a risk if thresholds are too low — start high (~0.88–0.90) and tune down carefully.
- Per-prompt-only v1 misses some multi-turn reuse; accepted to reduce risk and complexity.
- Cache bypass on DLP/policy failure or service outage must be **safe** (fail open to origin for cache path — do not fail closed the whole gateway solely because cache is down).

### Neutral

- Exact Vector DB product and embedding model revision may be chosen in implementation; **dedicated** store + **in-boundary bge/nomic-class** embeddings are locked.
- 8%+ hit rate is a **directional KPI**, not a hard SLO for launch; measure first, then gate.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Exact-string cache only | Misses near-duplicates; lower enterprise value |
| Embeddings via public API | Leaves the trust boundary for every cacheable prompt |
| Full multi-turn thread as cache key | Low hit quality; high leak surface |
| Shared cache of redacted/sensitive content | Cross-user leakage risk even with placeholders |
| “Reuse Conversation Memory Redis for vectors” | Couples hot session store to ANN; weaker product separation |
| No dedicated Vector DB | Harder to hit quality ANN at scale with clean ops |

## Related

- [Architecture §8 — Semantic Cache](../architecture.md#8-semantic-cache)
- Requirements: F8 (semantic cache), F4/F15 (DLP and isolation)
- [ADR-002: Policy Engine](002-policy-engine.md)
- [ADR-003: Input Guardrails / DLP](003-input-guardrails-dlp.md)
