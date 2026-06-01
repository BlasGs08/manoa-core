# =============================================================================
# Input Variables - Main Configuration
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API Token. Create one at: https://dash.cloudflare.com/profile/api-tokens"
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare Account ID. Found at: https://dash.cloudflare.com"
  type        = string
}

variable "environment" {
  description = "Environment name: 'dev' or 'prod'"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

# =============================================================================
# Worker Names
# =============================================================================

variable "api_worker_name" {
  description = "Base name for the API Worker (suffix will be added based on environment)"
  type        = string
  default     = "manoa-api"
}

variable "ai_worker_name" {
  description = "Base name for the AI Worker (suffix will be added based on environment)"
  type        = string
  default     = "manoa-ai"
}

# =============================================================================
# Plain Text Environment Variables (non-sensitive)
# =============================================================================

variable "api_plain_text_vars" {
  description = "Non-sensitive environment variables for the API worker"
  type        = map(string)
  default = {
    BETTER_AUTH_URL   = ""
    DASHBOARD_ORIGIN  = ""
    RESEND_FROM_EMAIL = "onboarding@resend.dev"
    ENVIRONMENT       = "production"
  }
}