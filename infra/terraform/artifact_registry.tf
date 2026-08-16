resource "google_artifact_registry_repository" "gateway" {
  project       = var.project_id
  location      = var.region
  repository_id = "gateway"
  description   = "Container images for @ellmgw/gateway (used from 1.7)."
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "gateway_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.gateway.location
  repository = google_artifact_registry_repository.gateway.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.gateway_runtime.email}"
}
