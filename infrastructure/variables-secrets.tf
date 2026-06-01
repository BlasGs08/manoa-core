# =============================================================================
# Sensitive Secrets (values should come from terraform.tfvars or env vars)
# =============================================================================

variable "secrets" {
  description = "Map of secret names to their encrypted values"
  type        = map(string)
  sensitive   = true
  default = {}
}

# Convenience variables for common secrets
variable "better_auth_secret" {
  description = "Secret key for Better Auth library"
  type        = string
  sensitive   = true
  default     = ""
}

variable "resend_api_key" {
  description = "API key for Resend (email service)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cf_account_id" {
  description = "Cloudflare Account ID (can be same as var.account_id)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cf_br_api_token" {
  description = "Cloudflare BROWSER API token"
  type        = string
  sensitive   = true
  default     = ""
}