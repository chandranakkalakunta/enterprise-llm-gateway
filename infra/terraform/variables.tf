variable "project_id" {
  type        = string
  description = "GCP project for the Phase 1 Foundation environment."
  default     = "ellmgw-dev"
}

variable "region" {
  type        = string
  description = "Primary region (Cloud Run / Artifact Registry)."
  default     = "asia-south1"
}

variable "gateway_sa_id" {
  type        = string
  description = "Account id for the runtime service account (email prefix)."
  default     = "gateway-runtime"
}

variable "gateway_service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "gateway"
}

variable "gateway_image" {
  type        = string
  description = "Full Artifact Registry image reference including tag."
}

variable "oidc_issuer" {
  type        = string
  description = "OIDC issuer."
  default     = "https://accounts.google.com"
}

variable "oidc_client_id" {
  type        = string
  description = "Google OAuth client ID (not a secret). Empty until Coordinator sets it."
  default     = ""
}

variable "oidc_audience" {
  type        = string
  description = "JWT audience; defaults to oidc_client_id when empty."
  default     = ""
}

variable "oidc_redirect_uri" {
  type        = string
  description = "Must match the Cloud Run HTTPS callback. Set after the first URL is known."
  default     = ""
}

variable "admin_emails" {
  type        = string
  description = "Comma-separated admin allow-list."
  default     = "admin@chandraailabs.com"
}

variable "grok_base_url" {
  type        = string
  description = "xAI OpenAI-compatible base URL."
  default     = "https://api.x.ai/v1"
}

variable "grok_default_model" {
  type        = string
  description = "Default Grok model."
  default     = "grok-4.5"
}

variable "grok_timeout_ms" {
  type        = number
  description = "Upstream Grok timeout in milliseconds."
  default     = 60000
}
