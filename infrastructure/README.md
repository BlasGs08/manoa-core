# Infrastructure as Code - Cloudflare Workers

Este directorio contiene la configuración Terraform para gestionar la infraestructura de Cloudflare del proyecto manoa-core.

## Recursos Gestionados

| Recurso | Descripción | Gestionado por |
|---------|-------------|----------------|
| D1 Database | Bases de datos SQL | Terraform |
| Queues | Sistema de colas para procesamiento async | Terraform |
| Workers | API y AI workers | Wrangler (via CI/CD) |
| Secrets | Variables sensibles | Wrangler secret |

## Estructura

```
infrastructure/
├── main.tf                    # Recursos principales (D1, Queues)
├── providers.tf               # Configuración del provider Cloudflare
├── variables.tf               # Variables de entrada
├── variables-secrets.tf       # Variables sensibles
├── outputs.tf                 # Outputs útiles
├── .gitignore                  # Archivos ignorados
├── .env.local                  # Credenciales (NO comittear)
├── .env.example                # Template de .env.local
├── .terraform/                 # Estado del provider (generado)
├── environments/
│   ├── dev/terraform.tfvars    # Variables para entorno DEV
│   └── prod/terraform.tfvars   # Variables para entorno PROD
└── workspaces/                 # Estados separados por entorno (generado)
```

## Ambientes

### DEV
- D1: `manoa-db-master-dev`
- Queue: `manoa-laws-scrape-dev`
- Workers: `manoa-api-dev`, `manoa-ai-dev`

### PROD
- D1: `manoa-db-master-prod`
- Queue: `manoa-laws-scrape-prod`
- Workers: `manoa-api-prod`, `manoa-ai-prod`

## Comandos

### Inicializar Terraform
```bash
cd infrastructure
terraform init
```

### Gestionar Workspaces
```bash
# Ver workspaces existentes
terraform workspace list

# Seleccionar workspace
terraform workspace select dev
terraform workspace select prod

# Crear nuevo workspace
terraform workspace new <nombre>
```

### Planificar cambios
```bash
# DEV
terraform plan -var-file="environments/dev/terraform.tfvars"

# PROD
terraform plan -var-file="environments/prod/terraform.tfvars"
```

### Aplicar cambios
```bash
# DEV (primero seleccionar workspace)
terraform workspace select dev
terraform apply -var-file="environments/dev/terraform.tfvars"

# PROD (primero seleccionar workspace)
terraform workspace select prod
terraform apply -var-file="environments/prod/terraform.tfvars"
```

## Configuración de Credenciales

### 1. Crear archivo `.env.local`

```bash
cp .env.example .env.local
```

### 2. Editar `.env.local` con tus credenciales

```env
TF_VAR_cloudflare_api_token=tu_api_token_de_cloudflare
TF_VAR_account_id=tu_account_id
```

### 3. Exportar variables (o usar `source` antes de cada comando)

```bash
source .env.local
```

## Variables de Entorno Requeridas

| Variable | Descripción |
|----------|-------------|
| `TF_VAR_cloudflare_api_token` | Token API de Cloudflare con permisos de Workers, D1, Queues |
| `TF_VAR_account_id` | ID de la cuenta de Cloudflare |

## API Token de Cloudflare

Para crear un API token:

1. Ve a https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Usa la plantilla "Workers API Token" o crea uno custom con:
   - [x] Workers:Edit
   - [x] D1:Edit
   - [x] Queues:Edit
   - [x] Account Settings:Read

## Notas Importantes

- **NUNCA comittees** `.env.local`, `.terraform/` o archivos `.tfstate`
- **Workspaces** separan el estado de cada ambiente
- **Secrets** (BETTER_AUTH_SECRET, RESEND_API_KEY, etc) se configuran via `wrangler secret put`
- **Workers** se despliegan via Wrangler, no Terraform (ver `.github/workflows/`)

## Recursos Crea

### DEV
```
cloudflare_d1_database.master: manoa-db-master-dev
cloudflare_queue.laws_scrape: manoa-laws-scrape-dev
```

### PROD
```
cloudflare_d1_database.master: manoa-db-master-prod
cloudflare_queue.laws_scrape: manoa-laws-scrape-prod
```

## Próximos Pasos

1. Configurar `wrangler.jsonc` con los nuevos database IDs
2. Configurar secrets via `wrangler secret put`
3. Crear el worker de IA (`src/ai/index.ts`)
4. Configurar GitHub Actions con los workflows de CI/CD

## Troubleshooting

### Error de autenticación
Verificar que el API token tenga los permisos correctos (Workers, D1, Queues)

### Error de workspace
Si Terraform muestra recursos incorrectos, verificar que estés en el workspace correcto:
```bash
terraform workspace show
```

### Recrear todo desde cero
```bash
# Destruir recursos
terraform destroy -var-file="environments/dev/terraform.tfvars"  # en workspace dev
terraform destroy -var-file="environments/prod/terraform.tfvars"  # en workspace prod

# Limpiar workspaces
terraform workspace delete dev
terraform workspace delete prod
```
