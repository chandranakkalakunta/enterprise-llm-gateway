# ADR-007: Observability Design — Privacy-Preserving Metrics, Logs and Traces

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-08-03 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | observability, opentelemetry, prometheus, grafana, privacy, siem, fail-open |

## Context

Operators need strong visibility into **health**, **performance**, **cost drivers**, and **security-relevant events** (policy denies, DLP blocks, circuit open). Without that, the Gateway becomes an opaque chokepoint.

Constraints that shape observability:

- **Raw prompts and responses must not** appear in normal logs, metrics labels, or default trace attributes — that would undermine DLP, metering privacy, and employee trust.
- Always-on **per-user metric labels** explode cardinality, storage, and cost.
- Preference for **open-source, low-cost, VPC-friendly** tooling that customers already know how to run.
- Observability pipelines must **never** become a single point of failure for the data plane: if Prometheus remote-write, log shippers, or tracers fail, user traffic continues.
- v1 should follow industry practice: **RED** metrics plus domain signals, **structured logging** with an allow-list of fields, and **safe** span attributes only.

## Decision

| Concern | Choice |
|---------|--------|
| Prompt / response content | **Never** log raw prompts or raw responses by default |
| Break-glass / debug | Tightly controlled, **time-limited**, **audited** mode may capture more detail — not the default |
| Per-user metrics | **Toggleable**; **off by default** (aggregated / low-cardinality); admin enables for investigation and disables afterwards |
| Instrumentation | **OpenTelemetry** |
| Metrics | **Prometheus** |
| Visualization | **Grafana** |
| Logs | **Loki** (or equivalent) |
| Traces | **Jaeger** or **Tempo** |
| SIEM | Export **structured** logs and audit events into the customer’s existing SIEM |
| Failure mode | **Fail-open** — observability failures do not block the main request path |
| v1 practice | RED + domain metrics; allow-listed log fields; safe trace attributes only |
| Core signals | Request rate, error rate, latency (p50/p95/p99), token throughput, cache hit rate, DLP actions (allow/redact/block), model fallback rate, circuit-breaker state, policy deny rate, Agent vs human traffic split |

### Principles

1. **Privacy by default** — same spirit as metering (ADR-006) and DLP (ADR-003).
2. **Low cardinality by default** — labels such as purpose, model, destination type, status; not unbounded free-text or always-on user_id series.
3. **Fail-open** — emit best-effort; never hold the stream for a metric scrape or log write.
4. **SIEM-ready** — structured JSON events customers can ship without reinventing schemas.

## Consequences

### Positive

- Strong **privacy posture** aligned with the rest of the Gateway.
- Operators can still **zoom in** (toggle per-user metrics; break-glass under process) when investigating incidents.
- Familiar **open-source stack** that can run privately at low cost.
- Clear **SLO-oriented** signals (RED + gateway-domain metrics) for ops and product.
- SIEM export respects enterprise security operations without forcing a single vendor SIEM.

### Negative / trade-offs

- Requires ongoing **discipline** on metric cardinality and log field allow-lists (code review + lint/tests).
- Break-glass debugging needs a **clear process**, short TTL, and audit trail — easy to abuse if informal.
- Default low-cardinality views may feel “less forensic” until investigation toggles are used.
- Running OTel + Prometheus + Grafana + Loki + Tempo/Jaeger is still an ops footprint (mitigated by customer familiarity and optional managed variants in-VPC).

### Neutral

- Metering analytical store (ClickHouse-class, ADR-006) remains for **business/chargeback** aggregates; Prometheus is for **ops** time-series. They complement, not replace, each other.
- Audit Log remains the system of record for policy/admin decisions; observability surfaces operational health and exports compatible events.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| Log full prompts at info for “debuggability” | Unacceptable privacy and compliance risk |
| Always-on per-user Prometheus labels | Cardinality and cost explosion |
| Proprietary-only APM as sole path | Conflicts with private, low-cost, open preference |
| Fail-closed when log pipeline is down | Turns observability into a data-plane outage |
| Traces with full message bodies as span events | Same as logging secrets into the trace backend |

## Related

- [Architecture §10 — Observability](../architecture.md#10-observability)
- Requirements: observability NFR; F9 privacy-respecting metering (adjacent)
- [ADR-003: Input Guardrails / DLP](003-input-guardrails-dlp.md)
- [ADR-006: Metering & Feedback](006-metering-and-feedback.md)
