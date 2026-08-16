# Terraform — ellmgw-dev foundation

Phase **1.2**. Manages APIs, the gateway runtime service account, Secret Manager **placeholders**, and an Artifact Registry repo.

**Does not** create Cloud Run services (1.7), OIDC clients (1.3), or secret *payloads*.

| Item | Value |
|------|--------|
| Project | `ellmgw-dev` |
| Region | `asia-south1` |
| State | `gs://ellmgw-dev-tfstate/gateway/dev` (bucket already exists) |

## Prerequisites

- `gcloud` authenticated as a principal that can enable APIs and create IAM/secrets in `ellmgw-dev`
- `terraform` >= 1.5
- Application Default Credentials: `gcloud auth application-default login`

```bash
gcloud config set project ellmgw-dev
```

## Plan / apply

```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Optional: `cp terraform.tfvars.example terraform.tfvars` (defaults already match `ellmgw-dev` / `asia-south1`).

Do **not** commit `tfplan`, `.terraform/`, or `*.tfstate`.

## Resources

- **APIs** via `google_project_service` (`disable_on_destroy = false`)
- **SA** `gateway-runtime@ellmgw-dev.iam.gserviceaccount.com`
  - `roles/logging.logWriter`, `roles/monitoring.metricWriter` (project)
  - `roles/secretmanager.secretAccessor` on the two gateway secrets only
  - `roles/artifactregistry.reader` on the `gateway` repo
- **Secrets** (empty — no versions in Terraform)
  - `ellmgw-gateway-grok-api-key`
  - `ellmgw-gateway-oidc-client-secret`
- **Artifact Registry** Docker repo `gateway` in `asia-south1`

Cloud Run in **1.7** should set `--service-account=$(terraform output -raw gateway_service_account_email)`. No JSON keys; Workload Identity / attached SA only.

## Set secret values out of band

Coordinator / operator, **not** Terraform:

```bash
# Grok API key (xAI)
printf '%s' 'YOUR_GROK_KEY' | gcloud secrets versions add ellmgw-gateway-grok-api-key \
  --project=ellmgw-dev --data-file=-

# OIDC client secret (Google Cloud Console OAuth client — 1.3)
printf '%s' 'YOUR_OIDC_CLIENT_SECRET' | gcloud secrets versions add ellmgw-gateway-oidc-client-secret \
  --project=ellmgw-dev --data-file=-
```

Never paste these values into `.tf`, `.tfvars`, or git.

## Destroy

Not expected for `ellmgw-dev`. If you must: `terraform destroy` does **not** disable APIs (`disable_on_destroy = false`).
