# ADR-003: Input Guardrails / DLP – Detection Strategy and Actions

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-07-25 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | dlp, input-guardrails, redaction, patterns, fail-closed |

## Context

Corporate data must be protected **before** any request leaves the trust boundary toward a public LLM. The Input Guardrails / DLP component is on the critical path for external egress and must balance:

- **Strong protection** of secrets, PII, regulated patterns, and company-specific IP markers
- **UX** that prefers continuation over hard stops when safe (redaction over block)
- **Admin extensibility** for organisation-specific sensitive patterns (active patents, internal codes, product codenames, etc.)
- **Integrity of the control plane** — detection itself must not exfiltrate content

Constraints that shape the decision:

- Sending prompt text to a **public LLM only to decide if it is sensitive** would defeat the purpose of DLP.
- Forcing hard blocks on every hit destroys developer trust and drives shadow AI (see open questions on DLP false positives).
- File and image scanning is important for real enterprise use but can be phased after a solid **text** pipeline.
- Rules and profiles must change without application code deploys (same data-driven posture as the Policy Engine).

## Decision

| Concern | Choice |
|---------|--------|
| v1 detection stack | **Regex + pattern libraries + basic ML/NER classifiers** |
| Public LLM for DLP evaluation | **Forbidden** — no external model calls for sensitivity detection |
| Default action | **Redact** sensitive spans and **continue** the request |
| High-sensitivity content | Explicit **Hard Block** (e.g. active patents, internal-only document markers) per profile |
| Custom corporate patterns | **First-class**, admin-manageable (create / modify / delete / version) |
| v1 content scope | **Text prompts only**; file/image scanning deferred but acknowledged as critical |
| Evaluation failure | **Fail-closed** for external destinations (block egress) |
| Configuration model | Fully **data-driven** rules, patterns, and **profiles** (no code change to add rules) |
| Policy integration | Receives **`dlp_profile`** (or equivalent) from the Policy Engine output |

### Action model (v1)

| Outcome | When | Effect |
|---------|------|--------|
| **Allow** | No hits above threshold | Unmodified text proceeds |
| **Redact** | Default for matched sensitive spans under the active profile | Spans replaced with stable placeholders; request continues |
| **Block** | Profile requires hard stop (high-sensitivity categories) or fail-closed error path | No external call; user receives a clear, non-leaky denial |

Internal-only destinations may apply a different profile (stricter or more relaxed) as decided by policy — DLP still runs under the profile policy selects; it does not invent its own routing.

## Consequences

### Positive

- **Security + UX balance**: redaction preserves flow for common paste accidents; block remains available for true stop-the-line cases.
- **No self-defeating DLP**: detection stays inside the trust boundary.
- **Admin agility**: company-specific IP markers and pattern packs without engineering tickets for every new code name.
- **Clear upgrade path**: text pipeline first; multimodal/file scanners plug in later under the same profile and action model.
- Aligns with fail-closed egress already locked in ADR-002.

### Negative / trade-offs

- **Advanced semantic / intent-level detection** is deferred (no large in-boundary LLM required for v1 DLP, and no public LLM allowed).
- Regex and basic NER have **false positive / false negative** risk — needs tuning, allowlists, and continuous review.
- Requires a solid **pattern and profile management** API/UI for admins (and safe publish / versioning).
- File/image paths remain a **known gap** until a later phase; product messaging must not claim full multimodal DLP in v1.

### Neutral

- Optional integration with existing enterprise DLP/CASB remains open for event export or secondary scan; v1 does not depend on it.
- Exact NER model choice and redaction placeholder format may get implementation ADRs; strategy above is locked.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Public LLM as DLP classifier | Sends the sensitive content to a third party to “check” it — unacceptable |
| Block-only (no redact) | Poor UX; drives workarounds and shadow AI |
| Redact-only (no hard block) | Insufficient for active patents / explicit internal-only markers |
| Full semantic LLM DLP in-VPC for v1 | Higher cost/latency/complexity; deferred until text baseline is proven |
| Code-embedded rule sets | Slow to change; contradicts data-driven admin model |

## Related

- [Architecture §5 — Input Guardrails / DLP](../architecture.md#5-input-guardrails--dlp)
- Requirements: F4 (input guardrails / DLP), F15 (isolation)
- [ADR-002: Policy Engine (OPA)](002-policy-engine.md) — supplies `dlp_profile` and egress posture
