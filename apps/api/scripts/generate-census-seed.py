#!/usr/bin/env python3
"""
Genera apps/api/src/modules/seed/census-data.ts a partir del cuadernillo Excel.
Uso: uv run --with xlrd python3 apps/api/scripts/generate-census-seed.py
"""

import re
import sys
from pathlib import Path

try:
    import xlrd
except ImportError:
    print("ERROR: xlrd no instalado. Usa: uv run --with xlrd python3 generate-census-seed.py")
    sys.exit(1)

# ──────────────────────────────────────────────
# Rutas
# ──────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
XLS_PATH = REPO_ROOT / "docs" / "CUADERNILLO TODAS LAS MANZANAS.xls"
OUT_PATH = SCRIPT_DIR.parent / "src" / "modules" / "seed" / "census-data.ts"

# ──────────────────────────────────────────────
# Normalización de dirección → (sector, number)
# ──────────────────────────────────────────────
# Caso especial: fila 299 del Excel tiene la dirección como float 13.0
# (desplazamiento de columna); por contexto de filas adyacentes corresponde
# a Manzana 11, Casa 13.
SPECIAL_ADDR_FLOAT = {"13.0": ("11", "13")}

def normalize_address(raw: str) -> tuple[str, str] | None:
    raw = str(raw).strip()

    # Caso especial float
    if raw in SPECIAL_ADDR_FLOAT:
        return SPECIAL_ADDR_FLOAT[raw]

    # Unificar variante "M10 A- N" → "M10A - N"
    raw = re.sub(r'\bM(10)\s+A\s*-+\s*', r'M10A - ', raw, flags=re.IGNORECASE)

    # Normalizar doble guion
    raw = re.sub(r'-{2,}', '-', raw)

    # Patrón 1: M{sector} - {num}  (ej: "M10A - 5", "M10B-3", "M14A - 2")
    m = re.match(r'^M([0-9]+[AB]?)\s*-\s*(\d+)\s*$', raw, re.IGNORECASE)
    if m:
        sector = m.group(1).upper()
        number = str(int(m.group(2)))
        return sector, number

    # Patrón 2: Manz {sector} N° {num}  (ej: "Manz 11 N° 3", "Manz 20B N° 9")
    m = re.match(r'^Manz\s+(\w+)\s+N[°o]?\s*(\d+)\s*$', raw, re.IGNORECASE)
    if m:
        sector = m.group(1).upper()
        number = str(int(m.group(2)))
        return sector, number

    # Patrón 3: M{sector}-{num} sin espacio (ej: "M16-01")
    m = re.match(r'^M([0-9]+[AB]?)-(\d+)\s*$', raw, re.IGNORECASE)
    if m:
        sector = m.group(1).upper()
        number = str(int(m.group(2)))
        return sector, number

    return None

# ──────────────────────────────────────────────
# Normalización de CI
# ──────────────────────────────────────────────
def normalize_ci(raw: str, global_idx: int) -> str:
    s = str(raw).strip()

    # Float positivo normal (ej: "8529865.0")
    try:
        f = float(s)
        if f > 0:
            return str(int(f))
        # f == 0.0 → sin CI
        return f"SIN_CI_{global_idx}"
    except ValueError:
        pass

    upper = s.upper()

    # Vacío o "NO TIENE"
    if not s or upper in ("NO TIENE", "NO TIENE", ""):
        return f"SIN_CI_{global_idx}"

    # Prefijo E- (extranjero): limpiar puntos y guiones internos, mantener E-
    if upper.startswith("E-"):
        digits = re.sub(r'[^0-9]', '', s[2:])
        return f"E-{digits}" if digits else f"SIN_CI_{global_idx}"

    # Prefijo V- (venezolano con prefijo): quitar el prefijo
    if upper.startswith("V-"):
        digits = re.sub(r'[^0-9]', '', s[2:])
        return digits if digits else f"SIN_CI_{global_idx}"

    # String con puntos/guiones intercalados (ej: "E-82.289.979" ya tratado)
    digits = re.sub(r'[^0-9]', '', s)
    if digits:
        return digits

    return f"SIN_CI_{global_idx}"

# ──────────────────────────────────────────────
# Parsing de nombre completo → (firstName, lastName)
# ──────────────────────────────────────────────
def is_initial(token: str) -> bool:
    """Retorna True si el token es una inicial (ej: "F.", "A.")."""
    return bool(re.match(r'^[A-ZÁÉÍÓÚÑ]\.$', token.upper()))

def split_name(full_name: str) -> tuple[str, str]:
    # Normalizar espacios múltiples
    name = re.sub(r'\s+', ' ', full_name.strip())

    # Limpiar trailing dots de tokens que NO sean iniciales (ej: "GONZALEZ." → "GONZALEZ")
    tokens = name.split()
    cleaned = []
    for t in tokens:
        if len(t) > 2 and t.endswith('.') and not is_initial(t):
            cleaned.append(t[:-1])
        else:
            cleaned.append(t)
    tokens = cleaned

    # Descartar iniciales al final (ej: "JESUS RODRIGUEZ F." → tokens[:2])
    while tokens and is_initial(tokens[-1]):
        tokens = tokens[:-1]

    if not tokens:
        return ("SIN_NOMBRE", "SIN_APELLIDO")
    if len(tokens) == 1:
        return (tokens[0], "SIN_APELLIDO")

    last_name = tokens[-1]
    first_name = " ".join(tokens[:-1])
    return (first_name, last_name)

# ──────────────────────────────────────────────
# Lectura del Excel
# ──────────────────────────────────────────────
def load_records():
    wb = xlrd.open_workbook(str(XLS_PATH))
    sh = wb.sheet_by_index(0)

    raw_rows = []
    for r in range(sh.nrows):
        row = [str(sh.cell_value(r, c)).strip() for c in range(sh.ncols)]
        try:
            float(row[0])
            raw_rows.append(row)
        except (ValueError, IndexError):
            pass

    return raw_rows

# ──────────────────────────────────────────────
# Pipeline principal
# ──────────────────────────────────────────────
def build_census_data(raw_rows: list) -> tuple[list, list]:
    houses_map: dict[str, dict] = {}  # key → {sector, number, address}
    citizens: list[dict] = []

    seen_dnis: dict[str, int] = {}
    seen_names_in_house: dict[str, set] = {}  # houseKey → set of (name+ci)

    # Contadores para log
    stats = {
        "raw": len(raw_rows),
        "skipped_empty": 0,
        "skipped_no_addr": 0,
        "skipped_note": 0,
        "skipped_dup_exact": 0,
        "ci_sin": 0,
        "ci_v_prefix": 0,
        "ci_e_prefix": 0,
        "ci_digits_only": 0,
        "ci_dup_resolved": 0,
        "addr_special": 0,
    }

    sin_ci_idx = 0

    for i, row in enumerate(raw_rows):
        full_name = row[1].strip()
        ci_raw = row[2].strip()
        addr_raw = row[3].strip()

        # Descartar filas vacías o con notas
        if not full_name or full_name.upper() in ("NO ESTÁ HABITADA", "NO ESTA HABITADA"):
            stats["skipped_note"] += 1
            continue

        # Parsear dirección
        addr_result = normalize_address(addr_raw)
        if addr_result is None:
            stats["skipped_no_addr"] += 1
            print(f"  [WARN] Fila {i+8}: dirección no parseable '{addr_raw}' | nombre: '{full_name}'")
            continue

        if addr_raw in SPECIAL_ADDR_FLOAT:
            stats["addr_special"] += 1

        sector, number = addr_result
        house_key = f"{sector}-{number}"

        # Registrar la casa si no existe
        if house_key not in houses_map:
            houses_map[house_key] = {
                "key": house_key,
                "sector": sector,
                "number": number,
                "address": f"Manzana {sector} Casa {number}",
            }
        if house_key not in seen_names_in_house:
            seen_names_in_house[house_key] = set()

        # Normalizar CI
        ci_upper = ci_raw.upper()
        if not ci_raw or ci_raw == "0.0" or ci_upper == "NO TIENE":
            stats["ci_sin"] += 1
        elif ci_upper.startswith("V-"):
            stats["ci_v_prefix"] += 1
        elif ci_upper.startswith("E-"):
            stats["ci_e_prefix"] += 1
        elif re.search(r'[^0-9.]', ci_raw):
            stats["ci_digits_only"] += 1

        sin_ci_idx += 1
        dni = normalize_ci(ci_raw, sin_ci_idx)

        # Detectar duplicados exactos (mismo nombre + misma casa)
        dedup_key = f"{full_name.upper()}|{house_key}"
        if dedup_key in seen_names_in_house[house_key]:
            stats["skipped_dup_exact"] += 1
            print(f"  [SKIP] Duplicado exacto: '{full_name}' en {house_key}")
            continue
        seen_names_in_house[house_key].add(dedup_key)

        # Resolver duplicados de CI (misma CI, persona diferente o casa diferente)
        if dni in seen_dnis:
            seen_dnis[dni] += 1
            original_dni = dni
            dni = f"{dni}_DUP_{seen_dnis[original_dni]}"
            stats["ci_dup_resolved"] += 1
            print(f"  [WARN] CI duplicada: '{full_name}' CI={original_dni} → renombrado a {dni}")
        else:
            seen_dnis[dni] = 1

        first_name, last_name = split_name(full_name)

        # Es jefe de hogar si es el primero en la casa (ya insertado en la lista)
        is_head = not any(c["houseKey"] == house_key for c in citizens)

        citizens.append({
            "dni": dni,
            "firstName": first_name,
            "lastName": last_name,
            "isHead": is_head,
            "houseKey": house_key,
        })

    houses = sorted(houses_map.values(), key=lambda h: (h["sector"], int(h["number"])))

    # Log de calidad
    print(f"\n[generate-census-seed] ═══════════════════════════")
    print(f"  Filas brutas:          {stats['raw']}")
    print(f"  Notas/vacíos saltados: {stats['skipped_note']}")
    print(f"  Sin dirección:         {stats['skipped_no_addr']}")
    print(f"  Duplicados exactos:    {stats['skipped_dup_exact']}")
    print(f"  ─────────────────────────────────────────────────")
    print(f"  Ciudadanos finales:    {len(citizens)}")
    print(f"  Casas únicas:          {len(houses)}")
    print(f"  ─────────────────────────────────────────────────")
    print(f"  CI → SIN_CI_N:         {stats['ci_sin']}")
    print(f"  CI con prefijo V-:     {stats['ci_v_prefix']} (prefijo removido)")
    print(f"  CI con prefijo E-:     {stats['ci_e_prefix']} (mantenidas)")
    print(f"  CI solo dígitos:       {stats['ci_digits_only']}")
    print(f"  CI duplicadas:         {stats['ci_dup_resolved']} (_DUP_N)")
    if stats['addr_special']:
        print(f"  Dirs especiales:       {stats['addr_special']} (float corregido)")
    print(f"[generate-census-seed] ═══════════════════════════\n")

    return houses, citizens

# ──────────────────────────────────────────────
# Generación del archivo TypeScript
# ──────────────────────────────────────────────
def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')

def generate_ts(houses: list, citizens: list) -> str:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        "// AUTO-GENERADO — NO EDITAR MANUALMENTE",
        f"// Regenerar con: uv run --with xlrd python3 apps/api/scripts/generate-census-seed.py",
        f"// Generado: {now}",
        f"// Fuente: docs/CUADERNILLO TODAS LAS MANZANAS.xls",
        f"// Registros: {len(citizens)} ciudadanos | {len(houses)} casas",
        "",
        "export interface CensusHouseRecord {",
        "  key: string;",
        "  sector: string;",
        "  number: string;",
        "  address: string;",
        "}",
        "",
        "export interface CensusCitizenRecord {",
        "  dni: string;",
        "  firstName: string;",
        "  lastName: string;",
        "  isHead: boolean;",
        "  houseKey: string;",
        "}",
        "",
        "export const CENSUS_HOUSES: CensusHouseRecord[] = [",
    ]

    for h in houses:
        lines.append(
            f'  {{ key: "{esc(h["key"])}", sector: "{esc(h["sector"])}", number: "{esc(h["number"])}", address: "{esc(h["address"])}" }},'
        )

    lines += [
        "];",
        "",
        "export const CENSUS_CITIZENS: CensusCitizenRecord[] = [",
    ]

    for c in citizens:
        is_head_str = "true" if c["isHead"] else "false"
        lines.append(
            f'  {{ dni: "{esc(c["dni"])}", firstName: "{esc(c["firstName"])}", lastName: "{esc(c["lastName"])}", isHead: {is_head_str}, houseKey: "{esc(c["houseKey"])}" }},'
        )

    lines += [
        "];",
        "",
    ]

    return "\n".join(lines)

# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    if not XLS_PATH.exists():
        print(f"ERROR: No se encontró el archivo Excel en: {XLS_PATH}")
        sys.exit(1)

    print(f"[generate-census-seed] Leyendo: {XLS_PATH}")
    raw_rows = load_records()
    print(f"[generate-census-seed] Filas cargadas: {len(raw_rows)}")

    houses, citizens = build_census_data(raw_rows)

    ts_content = generate_ts(houses, citizens)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(ts_content, encoding="utf-8")
    print(f"[generate-census-seed] Archivo generado: {OUT_PATH}")
    print(f"[generate-census-seed] Tamaño: {len(ts_content) / 1024:.1f} KB")
