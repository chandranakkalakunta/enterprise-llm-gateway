resource "google_service_account" "gateway_runtime" {
  project      = var.project_id
  account_id   = var.gateway_sa_id
  display_name = "Enterprise LLM Gateway runtime"
  description  = "Cloud Run runtime SA for @ellmgw/gateway. Attach in 1.7. Workload Identity-ready (no user keys)."

  depends_on = [google_project_service.required]
}

# Runtime needs to emit logs/metrics when Cloud Run attaches this SA (1.7).
resource "google_project_iam_member" "gateway_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gateway_runtime.email}"
}

resource "google_project_iam_member" "gateway_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gateway_runtime.email}"
}
