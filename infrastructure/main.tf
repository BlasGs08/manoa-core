# =============================================================================
# Infrastructure as Code - Cloudflare Workers
#
# MANAGED BY TERRAFORM:
#   - D1 Databases
#   - Queues
#
# MANAGED BY WRANGLER (CI/CD):
#   - Workers (deploy, versioning)
#   - Bindings
#   - Secrets (via wrangler secret or Secrets Store)
# =============================================================================

# =============================================================================
# D1 Database (per environment)
# =============================================================================

resource "cloudflare_d1_database" "master" {
  account_id = var.account_id
  name       = "manoa-db-master-${var.environment}"
}

# =============================================================================
# Queues (per environment)
# =============================================================================

resource "cloudflare_queue" "laws_scrape" {
  account_id = var.account_id
  name       = "manoa-laws-scrape-${var.environment}"
}