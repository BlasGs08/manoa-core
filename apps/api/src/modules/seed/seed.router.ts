import { Hono } from "hono";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { user as userTable } from "../../shared/database/schemas/auth.schema";
import * as schema from "../../shared/database/schemas";
import { CENSUS_HOUSES, CENSUS_CITIZENS } from "./census-data";
import type { HonoConfig } from "../../index";

export const seedRouter = new Hono<HonoConfig>();

seedRouter.use("/*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, X-Bootstrap-Key, X-Force-Reset");
  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }
  await next();
});

seedRouter.post("/seed-superadmin", async (c) => {
  const db = drizzle(c.env.DB, { schema: { user: userTable } });
  const users = await db.select().from(userTable).limit(1);
  if (users.length > 0) {
    return c.json({ error: "Already seeded" }, 409);
  }
  const { email, password, name } = await c.req.json();
  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "d1", schema: { user: userTable } }),
    emailAndPassword: { enabled: true },
    secret: c.env.BETTER_AUTH_SECRET as string,
    baseURL: c.env.BETTER_AUTH_URL,
  });
  const newUser = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: "superadmin",
    },
  });
  return c.json({ ok: true, user: newUser });
});

// ─────────────────────────────────────────────────────────────
// POST /api/seed/seed-census
// Pobla houses → citizens (sin family_id) → families → actualiza citizens.family_id
// Idempotente por defecto. X-Force-Reset: true trunca y re-inserta todo.
// ─────────────────────────────────────────────────────────────
const CHUNK = 10; // D1 limita a 100 variables por query; citizens tiene 8 cols → máx 12 rows

seedRouter.post("/seed-census", async (c) => {
  try {
    const { bootstrapAdminKey } = c.get("runtimeSecrets");

    if (!bootstrapAdminKey || c.req.header("X-Bootstrap-Key") !== bootstrapAdminKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = c.get("db");
    const forceReset = c.req.header("X-Force-Reset") === "true";

    // ── Truncado opcional (orden respetando FKs) ──────────────
    if (forceReset) {
      await db.delete(schema.citizens).run();
      await db.delete(schema.families).run();
      await db.delete(schema.houses).run();
    }

    // ── Fase A: Casas ─────────────────────────────────────────
    const existingHouses = await db
      .select({ id: schema.houses.id, sector: schema.houses.sector, number: schema.houses.number })
      .from(schema.houses)
      .all();

    const houseMap = new Map<string, string>(); // "sector-number" → id
    for (const h of existingHouses) {
      houseMap.set(`${h.sector}-${h.number}`, h.id);
    }

    const housesToInsert = CENSUS_HOUSES
      .filter((h) => !houseMap.has(h.key))
      .map((h) => ({ id: crypto.randomUUID(), address: h.address, sector: h.sector, number: h.number, key: h.key }));

    for (const h of housesToInsert) houseMap.set(`${h.sector}-${h.number}`, h.id);

    for (let i = 0; i < housesToInsert.length; i += CHUNK) {
      const chunk = housesToInsert.slice(i, i + CHUNK);
      await db
        .insert(schema.houses)
        .values(chunk.map((h) => ({ id: h.id, address: h.address, sector: h.sector, number: h.number })))
        .run();
    }

    // ── Fase B: Ciudadanos (sin family_id) ───────────────────
    const existingCitizens = await db
      .select({ id: schema.citizens.id, dni: schema.citizens.dni })
      .from(schema.citizens)
      .all();

    const citizenMap = new Map<string, string>(); // dni → id
    for (const cit of existingCitizens) citizenMap.set(cit.dni, cit.id);

    const citizensToInsert = CENSUS_CITIZENS
      .filter((cit) => !citizenMap.has(cit.dni))
      .map((cit) => ({ id: crypto.randomUUID(), ...cit }));

    for (const cit of citizensToInsert) citizenMap.set(cit.dni, cit.id);

    for (let i = 0; i < citizensToInsert.length; i += CHUNK) {
      const chunk = citizensToInsert.slice(i, i + CHUNK);
      await db
        .insert(schema.citizens)
        .values(
          chunk.map((cit) => ({
            id: cit.id,
            dni: cit.dni,
            firstName: cit.firstName,
            lastName: cit.lastName,
            birthDate: "1900-01-01",
            gender: "SIN_ESPECIFICAR",
            isHeadOfHousehold: cit.isHead,
            familyId: null,
          })),
        )
        .run();
    }

    // ── Fase C: Familias ─────────────────────────────────────
    const existingFamilies = await db
      .select({ id: schema.families.id, name: schema.families.name })
      .from(schema.families)
      .all();

    const familyMap = new Map<string, string>(); // houseKey → family.id
    const existingFamilyNames = new Set(existingFamilies.map((f) => f.name));

    const familyRecords = CENSUS_HOUSES.map((h) => {
      const head = CENSUS_CITIZENS.find((cit) => cit.houseKey === h.key && cit.isHead);
      const familyName = `Familia ${head?.lastName ?? "SIN_APELLIDO"} - M${h.sector} #${h.number}`;
      return {
        id: crypto.randomUUID(),
        houseKey: h.key,
        name: familyName,
        houseId: houseMap.get(h.key) ?? null,
        headId: head ? (citizenMap.get(head.dni) ?? null) : null,
      };
    }).filter((f) => f.houseId && !existingFamilyNames.has(f.name));

    for (const f of familyRecords) familyMap.set(f.houseKey, f.id);

    for (let i = 0; i < familyRecords.length; i += CHUNK) {
      const chunk = familyRecords.slice(i, i + CHUNK);
      await db
        .insert(schema.families)
        .values(
          chunk.map((f) => ({
            id: f.id,
            name: f.name,
            houseId: f.houseId!,
            headId: f.headId,
          })),
        )
        .run();
    }

    // Completar el mapa con familias que ya existían
    for (const h of CENSUS_HOUSES) {
      if (familyMap.has(h.key)) continue;
      const head = CENSUS_CITIZENS.find((cit) => cit.houseKey === h.key && cit.isHead);
      const familyName = `Familia ${head?.lastName ?? "SIN_APELLIDO"} - M${h.sector} #${h.number}`;
      const existing = existingFamilies.find((f) => f.name === familyName);
      if (existing) familyMap.set(h.key, existing.id);
    }

    // ── Fase D: Actualizar family_id en ciudadanos ────────────
    const citizensByHouse = new Map<string, string[]>(); // houseKey → [citizenId, ...]
    for (const cit of citizensToInsert) {
      const id = citizenMap.get(cit.dni);
      if (!id) continue;
      if (!citizensByHouse.has(cit.houseKey)) citizensByHouse.set(cit.houseKey, []);
      citizensByHouse.get(cit.houseKey)!.push(id);
    }

    let citizensUpdated = 0;
    for (const [houseKey, ids] of citizensByHouse) {
      const familyId = familyMap.get(houseKey);
      if (!familyId || ids.length === 0) continue;

      await db
        .update(schema.citizens)
        .set({ familyId })
        .where(inArray(schema.citizens.id, ids))
        .run();

      citizensUpdated += ids.length;
    }

    return c.json({
      ok: true,
      stats: {
        housesInserted: housesToInsert.length,
        citizensInserted: citizensToInsert.length,
        familiesInserted: familyRecords.length,
        citizensUpdated,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[seed-census] Error:", err);
    return c.json({ error: message, stack }, 500);
  }
});
