#!/usr/bin/env node
/**
 * Script interactivo para crear un Super Admin en DEV o PROD.
 *
 * Uso:
 *   npm run admin:create              # Pregunta el entorno
 *   npm run admin:create -- --env dev # Dev
 *   npm run admin:create -- --env prod
 */

import readline from "readline";
import { execSync } from "child_process";
import { hash } from "bcrypt";

const ENVIRONMENTS = {
  dev: {
    name: "DEV",
    dbName: "manoa-db-master-dev",
    dbEnv: "dev",
  },
  prod: {
    name: "PROD",
    dbName: "manoa-db-master-prod",
    dbEnv: "prod",
  },
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function createAdmin() {
  console.log("\n🛠️  Crear Super Admin - Manoa API\n");
  console.log("=".repeat(40) + "\n");

  // 1. Seleccionar entorno
  let envKey = await ask("¿En qué entorno? (1 = Dev, 2 = Prod) [1]: ");
  envKey = envKey.trim() || "1";
  const envKeyName = envKey === "2" ? "prod" : "dev";
  const env = ENVIRONMENTS[envKeyName];
  console.log(`   Usando: ${env.name}\n`);

  // 2. Pedir datos del admin
  const name = await ask("Nombre completo: ");
  if (!name.trim()) { console.error("❌ El nombre es requerido"); process.exit(1); }

  const email = await ask("Email: ");
  if (!email.includes("@")) { console.error("❌ Email inválido"); process.exit(1); }

  const password = await ask("Contraseña: ");
  if (password.length < 8) { console.error("❌ Mínimo 8 caracteres"); process.exit(1); }

  const confirmPassword = await ask("Confirmar contraseña: ");
  if (password !== confirmPassword) { console.error("❌ Las contraseñas no coinciden"); process.exit(1); }

  // 3. Generar datos
  const id = crypto.randomUUID();
  const emailLower = email.trim().toLowerCase();
  const nameTrimmed = name.trim();
  const hashedPassword = await hash(password, 10);
  const now = Date.now();

  // 4. Insertar usuario directamente en D1 (sin API)
  console.log(`\n⏳ Creando usuario en ${env.name}...`);

  const insertSQL = `
    INSERT INTO user (id, email, name, role, email_verified, banned, created_at, updated_at)
    VALUES (
      '${id}',
      '${emailLower}',
      '${nameTrimmed.replace(/'/g, "''")}',
      'superadmin',
      1,
      0,
      ${now},
      ${now}
    )
  `;

  // Crear también el hash en la tabla account para better-auth
  const accountId = crypto.randomUUID();
  const accountInsertSQL = `
    INSERT INTO account (
      id, account_id, provider_id, user_id, password, created_at, updated_at
    ) VALUES (
      '${accountId}',
      '${emailLower}',
      'credential',
      '${id}',
      '${hashedPassword.replace(/\$/g, "\\$")}',
      ${now},
      ${now}
    )
  `;

  try {
    // Ejecutar en D1 remoto
    execSync(
      `npx wrangler d1 execute ${env.dbName} --env ${env.dbEnv} --remote --command "${insertSQL.replace(/\n/g, " ").trim()}"`,
      { encoding: "utf8", stdio: "pipe" }
    );
    console.log("   ✅ Usuario creado!");

    // Insertar account con password hash
    execSync(
      `npx wrangler d1 execute ${env.dbName} --env ${env.dbEnv} --remote --command "${accountInsertSQL.replace(/\n/g, " ").trim()}"`,
      { encoding: "utf8", stdio: "pipe" }
    );
    console.log("   ✅ Contraseña configurada!");

    console.log("\n" + "=".repeat(40));
    console.log("🎉 ¡Superadmin creado exitosamente!");
    console.log(`   Nombre: ${nameTrimmed}`);
    console.log(`   Email: ${emailLower}`);
    console.log(`   Rol: superadmin`);
    console.log("=".repeat(40));
    console.log("\nYa puedes hacer login con estas credenciales.");

  } catch (error) {
    // Verificar si el usuario ya existe
    if (error.message.includes("UNIQUE constraint failed")) {
      console.error(`\n❌ El email ${emailLower} ya está registrado.`);
    } else {
      console.error(`\n❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

createAdmin().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});