/**
 * Validations Handler - CedulaVE Logic adapted to TypeScript
 *
 * Source 1 : api.cedula.com.ve (requires free API credentials)
 * Source 2 : api.vzlapi.com/actas (no auth, may be intermittent)
 * Source 3 : scraping directo de CNE (cne.gov.ve, may be intermittent)
 * Source 4 : padrón comunal local (citizens table — datos parciales)
 */

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../shared/database/schemas";

const CEDULA_COM_VE_URL = "https://api.cedula.com.ve/api/v1";
const VZLAPI_URL = "https://api.vzlapi.com/actas";
const CNE_URL = "http://www.cne.gov.ve/web/registro_electoral/ce.php";

export interface CedulaData {
  nac: string;
  dni: string;
  name: string;
  lastname: string;
  fullname: string;
  state: string;
  municipality: string;
  parish: string;
  voting: string;
  address: string;
  source?: "external" | "census";
}

export interface SuccessResponse {
  status: 200;
  data: CedulaData;
}

export interface ErrorResponse {
  status: number;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clean(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatterName(fullname: string): { name: string; lastname: string } {
  const parts = clean(fullname).split(" ").filter(Boolean);
  const count = parts.length;
  if (count <= 1) return { name: fullname, lastname: "" };
  if (count === 2) return { name: parts[0], lastname: parts[1] };
  if (count === 3) return { name: `${parts[0]} ${parts[1]}`, lastname: parts[2] };
  if (count === 4) return { name: `${parts[0]} ${parts[1]}`, lastname: `${parts[2]} ${parts[3]}` };
  const half = Math.round(count / 2);
  return { name: parts.slice(0, half).join(" "), lastname: parts.slice(half).join(" ") };
}

// ─── cedula.com.ve Source (Primary) ─────────────────────────────────────────

interface CedulaComVeResponse {
  error: boolean;
  error_str: string | null;
  data: {
    nacionalidad: string;
    cedula: string;
    primer_nombre: string;
    segundo_nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cne?: {
      estado: string;
      municipio: string;
      parroquia: string;
      centro_electoral: string;
    };
  } | false;
}

async function queryCedulaComVe(
  appId: string,
  token: string,
  nac: string,
  cedula: string,
): Promise<SuccessResponse | ErrorResponse> {
  const url = `${CEDULA_COM_VE_URL}?app_id=${encodeURIComponent(appId)}&token=${encodeURIComponent(token)}&nacionalidad=${encodeURIComponent(nac)}&cedula=${encodeURIComponent(cedula)}`;

  let json: CedulaComVeResponse;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ManoacoreValidator/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { status: 503, message: `cedula.com.ve no disponible (HTTP ${res.status}).` };
    }
    json = (await res.json()) as CedulaComVeResponse;
  } catch {
    return { status: 503, message: "No se pudo conectar a cedula.com.ve." };
  }

  if (json.error || !json.data) {
    if (json.error_str === "INVALID_TOKEN" || json.error_str === "APP_NOT_FOUND") {
      return { status: 401, message: "Credenciales de cedula.com.ve inválidas. Verifica APP_CEDULA_ID y APP_CEDULA_TOKEN." };
    }
    if (json.error_str === "CEDULA_NOT_FOUND") {
      return { status: 404, message: `La cédula ${nac}-${cedula} no se encontró en el registro.` };
    }
    return { status: 502, message: json.error_str ?? "Error en respuesta de cedula.com.ve." };
  }

  const d = json.data;
  const nameParts = [d.primer_nombre, d.segundo_nombre].filter(Boolean);
  const lastnameParts = [d.primer_apellido, d.segundo_apellido].filter(Boolean);
  const name = nameParts.join(" ");
  const lastname = lastnameParts.join(" ");
  const fullname = [...lastnameParts, ...nameParts].join(" ");

  return {
    status: 200,
    data: {
      nac,
      dni: cedula,
      name,
      lastname,
      fullname,
      state: clean(d.cne?.estado ?? ""),
      municipality: clean(d.cne?.municipio ?? ""),
      parish: clean(d.cne?.parroquia ?? ""),
      voting: clean(d.cne?.centro_electoral ?? ""),
      address: "",
      source: "external",
    },
  };
}

// ─── VZLApi Source ──────────────────────────────────────────────────────────

interface VzlapiResponse {
  Cedula?: string;
  StateName?: string;
  CountyName?: string;
  ParishName?: string;
  CenterName?: string;
  CenterAddress?: string;
  Error?: string;
}

async function queryVzlapi(nac: string, cedula: string): Promise<SuccessResponse | ErrorResponse> {
  const cedulaParam = `${nac}${cedula}`;
  const url = `${VZLAPI_URL}?cedula=${encodeURIComponent(cedulaParam)}`;

  let json: VzlapiResponse;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ManoacoreValidator/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { status: 503, message: `Servicio principal no disponible (HTTP ${res.status}). Intentando alternativa...` };
    }
    json = (await res.json()) as VzlapiResponse;
  } catch {
    return { status: 503, message: "No se pudo conectar al servicio principal." };
  }

  if (json.Error || !json.Cedula) {
    // vzlapi failed internally (e.g. its upstream CNE dependency is down)
    return { status: 502, message: json.Error ?? "Sin datos del servicio principal." };
  }

  const state = clean(json.StateName ?? "");
  const municipality = clean(json.CountyName ?? "");
  const parish = clean(json.ParishName ?? "");
  const voting = clean(json.CenterName ?? "");
  const address = clean(json.CenterAddress ?? "");

  // vzlapi only has location data, not names.
  // Try to fetch the name from CNE silently — if CNE is down, return partial data.
  const fullname = await queryNameFromCNE(nac, cedula);
  const { name, lastname } = fullname ? formatterName(fullname) : { name: "", lastname: "" };

  return {
    status: 200,
    data: { nac, dni: cedula, name, lastname, fullname: fullname ?? "", state, municipality, parish, voting, address },
  };
}

// ─── CNE Scraping (Fullname) ─────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function existData(content: string): boolean {
  const hasRegistro = content.toUpperCase().includes("REGISTRO ELECTORAL");
  const hasAdvertencia = content.toUpperCase().includes("ADVERTENCIA");
  return hasRegistro && !hasAdvertencia;
}

function processAndCleanData(content: string): string[] {
  const text = clean(stripHtml(content));
  const keywords = ["Cédula:", "Nombre:", "Estado:", "Municipio:", "Parroquia:", "Centro:", "Dirección:", "SERVICIO ELECTORAL", "Registro ElectoralCorte"];
  let replaced = text;
  for (const kw of keywords) {
    replaced = replaced.replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "|");
  }
  return replaced.split("|").map((s) => clean(s)).filter((s) => s.length > 0);
}

async function queryNameFromCNE(nac: string, cedula: string): Promise<string | null> {
  try {
    const url = `${CNE_URL}?nacionalidad=${encodeURIComponent(nac)}&cedula=${encodeURIComponent(cedula)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ManoacoreValidator/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!existData(html)) return null;
    const parts = processAndCleanData(html);
    return clean(parts[2] ?? "");
  } catch {
    return null;
  }
}

// ─── CNE Full Source (Fallback) ──────────────────────────────────────────────

async function queryCNE(nac: string, cedula: string): Promise<SuccessResponse | ErrorResponse> {
  try {
    const url = `${CNE_URL}?nacionalidad=${encodeURIComponent(nac)}&cedula=${encodeURIComponent(cedula)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ManoacoreValidator/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { status: 503, message: `El servicio del CNE tampoco está disponible (HTTP ${res.status}).` };
    }
    const html = await res.text();
    if (!existData(html)) {
      return { status: 404, message: `La cédula ${nac}-${cedula} no se encontró en el registro electoral del CNE.` };
    }
    const parts = processAndCleanData(html);
    if (parts.length < 7) {
      return { status: 500, message: "No se pudo parsear la respuesta del CNE." };
    }
    const fullname = clean(parts[2] ?? "");
    const { name, lastname } = formatterName(fullname);
    return {
      status: 200,
      data: {
        nac,
        dni: cedula,
        name,
        lastname,
        fullname,
        state: clean(parts[3] ?? ""),
        municipality: clean(parts[4] ?? ""),
        parish: clean(parts[5] ?? ""),
        voting: clean(parts[6] ?? ""),
        address: clean(parts[7] ?? ""),
      },
    };
  } catch {
    return {
      status: 503,
      message: "No se pudo conectar a ninguna fuente de consulta (vzlapi.com ni CNE). Esto puede ocurrir en entorno de desarrollo local si tu red no tiene acceso a dominios venezolanos. Prueba en producción.",
    };
  }
}

// ─── Census Local Fallback ───────────────────────────────────────────────────

async function queryCensus(
  db: DrizzleD1Database<typeof schema>,
  nac: string,
  cedula: string,
): Promise<SuccessResponse | null> {
  try {
    const row = await db.select().from(schema.citizens).where(eq(schema.citizens.dni, cedula)).get();
    if (!row) return null;
    const fullname = `${row.firstName} ${row.lastName}`;
    return {
      status: 200,
      data: {
        nac,
        dni: cedula,
        name: row.firstName,
        lastname: row.lastName,
        fullname,
        state: "",
        municipality: "",
        parish: "",
        voting: "",
        address: "",
        source: "census",
      },
    };
  } catch {
    return null;
  }
}

// ─── Main Entry ──────────────────────────────────────────────────────────────

export interface CedulaQueryOptions {
  db?: DrizzleD1Database<typeof schema>;
  appCedulaId?: string;
  appCedulaToken?: string;
}

export async function queryCedula(
  nac: string,
  cedula: string,
  opts: CedulaQueryOptions = {},
): Promise<SuccessResponse | ErrorResponse> {
  if (nac !== "V" && nac !== "E") {
    return { status: 301, message: "Nacionalidad inválida. Los valores permitidos son V o E." };
  }
  if (!cedula || cedula.trim() === "") {
    return { status: 302, message: "La cédula no puede estar vacía." };
  }
  if (!/^\d+$/.test(cedula)) {
    return { status: 303, message: "La cédula solo debe contener caracteres numéricos." };
  }

  const { db, appCedulaId, appCedulaToken } = opts;

  // 1st: api.cedula.com.ve — full data, requires free credentials
  if (appCedulaId && appCedulaToken) {
    const result = await queryCedulaComVe(appCedulaId, appCedulaToken, nac, cedula);
    if (result.status === 200) return result;
    // 401 means invalid credentials — don't fall through to avoid confusing errors
    if (result.status === 401) return result;
    // 404 means definitely not found — skip remaining external sources
    if (result.status === 404) {
      if (db && nac === "V") {
        const census = await queryCensus(db, nac, cedula);
        if (census) return census;
      }
      return result;
    }
  }

  // 2nd: vzlapi.com
  const vzlapiResult = await queryVzlapi(nac, cedula);
  if (vzlapiResult.status === 200) {
    const ok = vzlapiResult as SuccessResponse;
    return { status: 200 as const, data: { ...ok.data, source: "external" as const } };
  }

  // 3rd: CNE direct scraping
  const cneResult = await queryCNE(nac, cedula);
  if (cneResult.status === 200) {
    const ok = cneResult as SuccessResponse;
    return { status: 200 as const, data: { ...ok.data, source: "external" as const } };
  }

  // 4th: Local census — only for Venezuelan nationals
  if (db && nac === "V") {
    const census = await queryCensus(db, nac, cedula);
    if (census) return census;
  }

  return cneResult;
}
