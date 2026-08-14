# ADR-009: Deployment Topology & High Availability

| Field | Value |
|-------|--------|
| **Status** | Accepted |
| **Date** | 2026-08-14 |
| **Deciders** | Architecture / product (Enterprise LLM Gateway) |
| **Tags** | deployment, ha, gcp, cloud-run, gke, private-dc, bigquery, clickhouse, egress, fail-closed |

## Context

The Gateway is a **customer-controlled control plane**. It must run inside a trust boundary the customer owns — not as a multi-tenant public SaaS — and still be operable by a typical platform team.

Constraints that shape the decision:

- **Phase 1 must ship on one cloud** so implementation, IAM, networking, and ops runbooks stay concrete. The organisation’s primary cloud is **Google Cloud**.
- **Private Data Center** remains a first-class *destination* for the product (enterprises that will not put the hop in a public cloud). It is **not** a Phase 1 implementation target; it must still be designed so we do not paint ourselves into GCP-only APIs.
- Start **cost-conscious** (managed services, scale-to-near-zero where safe) without abandoning portability.
- **v1 HA** is single-region high availability. Multi-region active-active is an open later question (policy snapshot consistency, cache, conversation memory). The design must **not block** a stronger HA story.
- The **same Gateway binary and configuration model** must run on GCP and, later, in a private DC. Environment-specific values (endpoints, secrets, IdP, feature flags) change; the application does not fork.
- Unauthenticated traffic is **fail-closed** (ADR-008). External model calls remain **fail-closed** on Policy / DLP failure (ADR-002, ADR-003). Egress from the VPC must be **controlled**, not a default-open NAT.

ADR-006 left the analytical store as a private-friendly warehouse with ClickHouse as a strong candidate. This ADR **maps that interface onto environments**: BigQuery on GCP Phase 1; ClickHouse-class on Private DC.

## Decision

| Concern | Choice |
|---------|--------|
| Phase 1 implementation | **Google Cloud only** |
| Private Data Center | **Documented recommended architecture**; **not implemented** in Phase 1 |
| Compute | **Hybrid:** **Cloud Run** for suitable stateless services + **GKE** for sidecars / advanced networking |
| Stateful (GCP) | **Cloud SQL PostgreSQL (HA)**, **Memorystore Redis (HA)**, **private-friendly Vector DB**, **BigQuery** for metering / analytics |
| Attachments | **Cloud Storage** |
| Secrets | **Secret Manager** + **Workload Identity** (no long-lived keys on disk) |
| Analytical store | **BigQuery** on GCP; **ClickHouse** (or equivalent) on Private DC — **same metering interface** |
| Observability | Open-source stack **inside the VPC** (Prometheus / Grafana / Loki / Tempo) **or** Google managed equivalent |
| Egress | **Controlled only** — Private Google Access / PSC / explicit allow-lists; no open internet from workloads |
| Unauthenticated traffic | **Fail-closed** (ADR-008) |
| HA (v1) | **Single-region** high availability (multi-AZ). Stronger multi-region HA left open |
| Application model | **Same Gateway binary and configuration model** across GCP and future Private DC |

### Topology

Phase 1 implements **Google Cloud only**. Private Data Center is the documented future analogue — not a Phase 1 build.

![High-level deployment topology](../assets/deployment-topology-overview.svg)

*Figure 1. Google Cloud Phase 1 (implemented) versus Private Data Center (documented future). Same Gateway binary and configuration model.*

### Phase 1 (GCP) sketch

1. Regional HTTPS load balancer in the **customer VPC**. TLS in-boundary. No anonymous backend.
2. **GKE** (regional cluster) runs the streaming **data plane**, **OPA sidecar**, in-boundary **DLP / NER**, and **embedding** workers — anything that needs sidecars, local models, or careful network policy.
3. **Cloud Run** runs suitable **stateless** surfaces: Admin API, config publish, async metering writers, other workers. A service **may later move Cloud Run → GKE** if sidecar or networking needs grow; that is expected, not a failure of the hybrid.
4. **Cloud SQL PostgreSQL (HA)** is durable conversation memory and admin/policy metadata (ADR-001).
5. **Memorystore Redis (HA)** is the hot working set and short-lived counters (ADR-001, ADR-006).
6. A **dedicated, private-friendly Vector DB** holds semantic-cache embeddings (ADR-005). Product SKU is an implementation choice; “dedicated + in-boundary” is not optional.
7. **BigQuery** receives **async, metadata-only** metering aggregates. **Cloud Storage** holds attachments.
8. Workloads authenticate to Google APIs and data stores with **Workload Identity**. Provider keys and IdP client secrets live in **Secret Manager**.
9. Egress to public LLM APIs is **allow-listed** (Cloud NAT and/or PSC). Internal LLM / RAG stay on private IP / PSC. Policy or DLP deny → **no packet** to a public provider.

![Google Cloud Phase 1 deployment](../assets/deployment-topology-gcp-phase1.svg)

*Figure 2. Detailed single-region GCP topology — hybrid Cloud Run + GKE, managed state, controlled egress.*

### Private DC (documented, not Phase 1)

Same logical tiers, customer-operated:

| GCP Phase 1 | Private DC analogue |
|-------------|---------------------|
| Cloud Run + GKE | Kubernetes (and optional Knative / comparable scale-to-zero later) |
| Cloud SQL PostgreSQL HA | In-boundary PostgreSQL HA (e.g. CloudNativePG / Patroni) |
| Memorystore Redis HA | In-boundary Redis HA |
| Private Vector DB | Same class, in-boundary |
| BigQuery | **ClickHouse** (or equivalent) |
| Cloud Storage | S3-compatible object store |
| Secret Manager + Workload Identity | Customer secret store + workload identity (Vault or equivalent) |
| PGA / PSC / allow-listed NAT | Explicit egress proxy / firewall allow-lists |

The Gateway image, config schema, and request path do not change.

### HA posture

- **v1:** one region, multiple zones. Regional GKE, Cloud Run regional, Cloud SQL HA, Memorystore HA, multi-AZ object storage, BigQuery regional or multi-region dataset as the customer’s data-residency policy allows.
- **Not v1:** active-active multi-region control plane. Do not introduce single-region-only assumptions that are expensive to undo (keep policy snapshots, principal ids, and cache keys **location-agnostic**; avoid hard-coded regional failover hacks in application code).
- Observability remains **fail-open**. Auth, Policy egress, and DLP egress remain **fail-closed**.

## Consequences

### Positive

- **Faster, lower-ops start on GCP** — managed HA data services and Cloud Run for the boring stateless edges.
- **Clear portability path** to Private DC: one binary, one config model, documented analogues for every stateful dependency.
- Hybrid compute matches real needs: OPA sidecars and local models do not have to be forced onto Cloud Run on day one.
- Analytical **interface** stays stable while the **engine** can be BigQuery or ClickHouse.
- Single-region HA is honest for v1 and cheaper than pretending to be globally active-active.

### Negative / trade-offs

- Phase 1 is **GCP-shaped**. Private DC customers wait; they get a design, not a Helm chart in this phase.
- Hybrid Cloud Run + GKE is **two compute platforms** to secure, observe, and deploy. Mitigate with one image, one pipeline, Workload Identity everywhere.
- **Some Cloud Run services will likely move to GKE** as sidecar / networking needs grow. Plan for that move; do not treat first placement as sacred.
- BigQuery vs ClickHouse means **two adapters** behind the metering writer. The schema and privacy rules (ADR-006) must stay adapter-agnostic.
- Single-region HA is **not** a multi-region RPO/RTO story. Customers with active-active requirements need a later ADR.

### Neutral

- Vector DB SKU (Vertex AI Vector Search with private access, self-hosted Qdrant/Weaviate on GKE, etc.) remains an implementation choice under ADR-005 constraints.
- Google managed observability is acceptable if it preserves ADR-007 privacy and fail-open contracts.
- CMEK, VPC-SC, and org-policy hardening are expected on a customer project; they do not change this topology.

## Alternatives considered

| Option | Why not chosen |
|--------|----------------|
| GKE-only in Phase 1 | Operable, but higher standing cost and ops for services that Cloud Run already fits |
| Cloud Run-only | Sidecars (OPA), local NER/embeddings, and advanced network policy are a poor fit |
| Multi-cloud in Phase 1 | Dilutes IAM, networking, and the first ship; portability is via binary/config, not dual-cloud day one |
| Implement Private DC in Phase 1 | Splits engineering; document first, implement when a customer pulls it |
| ClickHouse on GCP as well | Valid, but BigQuery is the lower-ops GCP native for the locked aggregate grain; keep ClickHouse for Private DC |
| Active-active multi-region in v1 | Policy, cache, and memory consistency cost is not justified before single-region HA is proven |
| Default-open Cloud NAT | Violates controlled-egress and fail-closed egress posture |

## Related

- [Architecture §12 — Deployment Topology & High Availability](../architecture.md#12-deployment-topology--high-availability)
- Requirements: private deployment NFR; F12 (horizontal scale)
- [ADR-001: Conversation Memory Storage](001-conversation-memory-storage.md)
- [ADR-005: Semantic Cache](005-semantic-cache.md)
- [ADR-006: Metering & Feedback](006-metering-and-feedback.md) — environment mapping for the analytical store
- [ADR-007: Observability](007-observability.md)
- [ADR-008: Authentication & SSO](008-authentication-sso.md) — fail-closed unauthenticated traffic
