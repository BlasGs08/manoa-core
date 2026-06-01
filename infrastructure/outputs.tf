# =============================================================================
# Outputs - Resources managed by Terraform
# =============================================================================

output "database_name" {
  description = "Name of the D1 database"
  value       = cloudflare_d1_database.master.name
}

output "database_id" {
  description = "ID of the D1 database"
  value       = cloudflare_d1_database.master.id
}

output "queue_name" {
  description = "Name of the Laws Scrape Queue"
  value       = cloudflare_queue.laws_scrape.name
}

output "queue_id" {
  description = "ID of the Laws Scrape Queue"
  value       = cloudflare_queue.laws_scrape.id
}