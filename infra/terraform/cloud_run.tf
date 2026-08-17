resource "google_cloud_run_v2_service" "gateway" {
  project             = var.project_id
  name                = var.gateway_service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  # Org policy iam.allowedPolicyMemberDomains blocks allUsers / allAuthenticatedUsers.
  # Disabling invoker IAM is the supported equivalent of a public Cloud Run URL;
  # app-level OIDC still gates /v1/*.
  invoker_iam_disabled = true

  template {
    service_account = google_service_account.gateway_runtime.email
    timeout         = "60s"
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    containers {
      image = var.gateway_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      # PORT is reserved by Cloud Run; it injects 8080 from container_port.
      env {
        name  = "OIDC_ISSUER"
        value = var.oidc_issuer
      }
      env {
        name  = "OIDC_CLIENT_ID"
        value = var.oidc_client_id
      }
      env {
        name  = "OIDC_AUDIENCE"
        value = var.oidc_audience != "" ? var.oidc_audience : var.oidc_client_id
      }
      env {
        name  = "OIDC_REDIRECT_URI"
        value = var.oidc_redirect_uri
      }
      env {
        name  = "ADMIN_EMAILS"
        value = var.admin_emails
      }
      env {
        name  = "GROK_BASE_URL"
        value = var.grok_base_url
      }
      env {
        name  = "GROK_DEFAULT_MODEL"
        value = var.grok_default_model
      }
      env {
        name  = "GROK_TIMEOUT_MS"
        value = tostring(var.grok_timeout_ms)
      }
      env {
        name = "GROK_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gateway["ellmgw-gateway-grok-api-key"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OIDC_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gateway["ellmgw-gateway-oidc-client-secret"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_artifact_registry_repository.gateway,
    google_secret_manager_secret_iam_member.gateway_accessor,
  ]
}
