# Terraform — ellmgw-dev foundation + Cloud Run

Phase **1.2** (APIs, SA, secrets, Artifact Registry) and **1.7** (Cloud Run).

| Item | Value |
|------|--------|
| Project | `ellmgw-dev` |
| Region | `asia-south1` |
| State | `gs://ellmgw-dev-tfstate/gateway/dev` |
| Image | `asia-south1-docker.pkg.dev/ellmgw-dev/gateway/gateway:<tag>` |
| Runtime SA | `gateway-runtime@ellmgw-dev.iam.gserviceaccount.com` |

## Prerequisites

- `gcloud` authenticated; `gcloud auth application-default login`
- `terraform` >= 1.5
- Docker (linux/amd64) for image push
- Secret **versions** already exist for `ellmgw-gateway-grok-api-key` and `ellmgw-gateway-oidc-client-secret`

```bash
gcloud config set project ellmgw-dev
```

## Build and push the image

From the **repository root**:

```bash
chmod +x scripts/push-gateway-image.sh
./scripts/push-gateway-image.sh
```

This tags `gateway:<git-sha>` and `gateway:latest`.

## Plan / apply

```bash
cd infra/terraform
terraform init
terraform plan \
  -var='gateway_image=asia-south1-docker.pkg.dev/ellmgw-dev/gateway/gateway:latest' \
  -out=tfplan
terraform apply tfplan
terraform output gateway_service_uri
```

After the first URL is known, set the OAuth redirect and re-apply (non-secret):

```bash
URL="$(terraform output -raw gateway_service_uri)"
terraform apply -auto-approve \
  -var="gateway_image=asia-south1-docker.pkg.dev/ellmgw-dev/gateway/gateway:latest" \
  -var="oidc_redirect_uri=${URL}/auth/callback" \
  -var="oidc_client_id=YOUR_GOOGLE_OAUTH_CLIENT_ID"
```

Add `${URL}/auth/callback` to the Google Cloud OAuth client's authorized redirect URIs.

`ellmgw-dev` is under org policy `constraints/iam.allowedPolicyMemberDomains` (customer `C02zg9f48` only). That blocks `roles/run.invoker` for `allUsers`. The service uses `invoker_iam_disabled = true` instead so HTTPS `/health` is reachable; app-level OIDC still protects `/v1/*`.

Do **not** put `OIDC_CLIENT_SECRET` or `GROK_API_KEY` in `.tfvars`. They are bound from Secret Manager (`latest`).

Optional local file `terraform.tfvars` (gitignored) for non-secret values. Start from `terraform.tfvars.example`.

## Smoke

```bash
curl -sS "$(terraform output -raw gateway_service_uri)/health"
```

`/v1/me` and `/v1/chat/completions` need a valid Google ID token after the redirect URI and `oidc_client_id` are set.

## Resources

- APIs, runtime SA, secret placeholders, Artifact Registry (1.2)
- Cloud Run service `gateway` (1.7), `invoker_iam_disabled = true` (org policy blocks `allUsers`; app-level OIDC still required)
- Container port `8080`. Do not set env `PORT` in Terraform — Cloud Run reserves it and injects it.
- Secret env: `GROK_API_KEY`, `OIDC_CLIENT_SECRET`
