#!/usr/bin/env tsx
/**
 * Dispara el endpoint /api/seed/seed-census contra la API.
 *
 * Variables de entorno:
 *   BOOTSTRAP_ADMIN_KEY  — requerida
 *   API_BASE_URL         — opcional, default: http://localhost:8787
 *   FORCE_RESET          — "true" para truncar y re-insertar todo
 *
 * Uso local:
 *   BOOTSTRAP_ADMIN_KEY=tu-clave npm run seed:census
 *
 * Uso en producción:
 *   BOOTSTRAP_ADMIN_KEY=tu-clave API_BASE_URL=https://manoa-api.workers.dev npm run seed:census
 *
 * Reset completo (⚠️ borra TODOS los ciudadanos, familias y casas):
 *   BOOTSTRAP_ADMIN_KEY=tu-clave FORCE_RESET=true npm run seed:census
 */

const BOOTSTRAP_KEY = process.env.BOOTSTRAP_ADMIN_KEY;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";
const FORCE_RESET = process.env.FORCE_RESET === "true";

if (!BOOTSTRAP_KEY) {
  console.error("ERROR: falta la variable de entorno BOOTSTRAP_ADMIN_KEY");
  process.exit(1);
}

const url = `${API_BASE_URL}/api/seed/seed-census`;

console.log(`[seed-census] Ejecutando: POST ${url}`);
if (FORCE_RESET) {
  console.warn("[seed-census] ⚠️  FORCE_RESET=true — se borrarán ciudadanos, familias y casas existentes");
}

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Bootstrap-Key": BOOTSTRAP_KEY,
    ...(FORCE_RESET ? { "X-Force-Reset": "true" } : {}),
  },
});

const body = await response.json();

if (!response.ok) {
  console.error(`[seed-census] Error ${response.status}:`, body);
  process.exit(1);
}

const stats = (body as { stats: Record<string, number> }).stats;
console.log("[seed-census] ✓ Completado");
console.log(`  Casas insertadas:       ${stats.housesInserted}`);
console.log(`  Ciudadanos insertados:  ${stats.citizensInserted}`);
console.log(`  Familias insertadas:    ${stats.familiesInserted}`);
console.log(`  Ciudadanos actualizados (family_id): ${stats.citizensUpdated}`);
