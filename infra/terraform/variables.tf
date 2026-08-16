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
