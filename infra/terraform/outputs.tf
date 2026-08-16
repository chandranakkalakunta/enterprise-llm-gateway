output "project_id" {
  value       = var.project_id
  description = "GCP project."
}

output "region" {
  value       = var.region
  description = "Primary region."
}

output "enabled_apis" {
  value       = sort([for s in google_project_service.required : s.service])
  description = "APIs enabled via google_project_service."
}

output "gateway_service_account_email" {
  value       = google_service_account.gateway_runtime.email
  description = "Runtime SA to attach to Cloud Run in 1.7."
}

output "secret_ids" {
  value       = sort([for s in google_secret_manager_secret.gateway : s.secret_id])
  description = "Secret Manager secret ids (placeholders; add versions out of band)."
}

output "artifact_registry_repository" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.gateway.repository_id}"
  description = "Docker repo path for gateway images."
}

output "gateway_service_uri" {
  value       = google_cloud_run_v2_service.gateway.uri
  description = "HTTPS base URL of the Cloud Run service."
}

output "oidc_callback_uri" {
  value       = "${google_cloud_run_v2_service.gateway.uri}/auth/callback"
  description = "Set this as the Google OAuth authorized redirect URI and as oidc_redirect_uri."
}
