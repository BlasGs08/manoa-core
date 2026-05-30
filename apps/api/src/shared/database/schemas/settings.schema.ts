import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const councilProfile = sqliteTable("council_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Consejo Comunal"),
  rif: text("rif"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
