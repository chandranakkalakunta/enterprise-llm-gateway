locals {
  gateway_secrets = [
    "ellmgw-gateway-grok-api-key",
    "ellmgw-gateway-oidc-client-secret",
  ]
}

# Placeholders only. Secret *versions* (payloads) are added out of band.
# See README.md — never put real values in Terraform.
resource "google_secret_manager_secret" "gateway" {
  for_each = toset(local.gateway_secrets)

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  labels = {
    app     = "ellmgw-gateway"
    purpose = "phase-1-placeholder"
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "gateway_accessor" {
  for_each = google_secret_manager_secret.gateway

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gateway_runtime.email}"
}
