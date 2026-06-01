/**
 * manoa-ai Worker
 *
 * Worker dedicado al procesamiento de IA.
 * - Mantiene compatibilidad con Durable Objects via HTTP
 * - Procesa streaming de chat
 * - Accede a D1 para persistencia de conversaciones
 *
 * Para usar desde el frontend (futuro):
 * POST /chat con { messages: [], userId, conversationId }
 * Devuelve streaming response
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, count, sql } from "drizzle-orm";
import * as schema from "../shared/database/schemas";

type AIBindings = {
  DB: D1Database;
  AI: Ai;
  AI_WORKER?: Fetcher;
};

const app = new Hono<{ Bindings: AIBindings }>();

// CORS
app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
}));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", worker: "manoa-ai" });
});

const SYSTEM_PROMPT = `Eres el Asistente Virtual del Consejo Comunal de Manoa, los datos a mostrar unicamente provienen de las tools que dispones, no inventes datos. Tu función es orientar a los vecinos de la comunidad sobre trámites, reportes de servicios y convivencia.

Instrucciones de Respuesta:
- Personalidad: Eres un vecino digital: amable, respetuoso y colaborador. Usa un lenguaje claro y natural de Venezuela y en español.
- Brevedad: Ve directo al punto. Usa listas de puntos (*) para requisitos o pasos a seguir.
- Trámites y Reportes: Indica requisitos para cartas de residencia o censos. Si reportan fallas (luz, agua, gas), solicita siempre: Calle, Manzana y número de casa.
- Neutralidad: Enfócate 100% en la gestión vecinal y soluciones comunitarias, evitando debates políticos.
- Cierre: Si no tienes un dato exacto (como fechas de entrega de beneficios), sugiere estar atentos a los grupos de WhatsApp oficiales o al vocero de la calle.`;

function buildTools(db: any) {
  return {
    censusSummary: tool({
      description: "Obtiene un resumen general del censo: total de viviendas, familias y habitantes registrados en la comunidad.",
      inputSchema: z.object({}),
      execute: async () => {
        const [housesCount] = await db.select({ total: count() }).from(schema.houses);
        const [familiesCount] = await db.select({ total: count() }).from(schema.families);
        const [citizensCount] = await db.select({ total: count() }).from(schema.citizens);
        return {
          viviendas: housesCount?.total ?? 0,
          familias: familiesCount?.total ?? 0,
          habitantes: citizensCount?.total ?? 0,
        };
      },
    }),

    demographicsByGender: tool({
      description: "Obtiene la distribución de habitantes por género.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({ gender: schema.citizens.gender, total: count() })
          .from(schema.citizens)
          .groupBy(schema.citizens.gender);
        return rows.map((r: any) => ({ genero: r.gender, cantidad: r.total }));
      },
    }),

    demographicsByAge: tool({
      description: "Obtiene la distribución de habitantes por grupo etario.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            ageGroup: sql<string>`case
              when (julianday('now') - julianday(${schema.citizens.birthDate})) / 365.25 < 12 then 'Niños (0-11)'
              when (julianday('now') - julianday(${schema.citizens.birthDate})) / 365.25 < 18 then 'Adolescentes (12-17)'
              when (julianday('now') - julianday(${schema.citizens.birthDate})) / 365.25 < 60 then 'Adultos (18-59)'
              else 'Adultos mayores (60+)'
            end`,
            total: count(),
          })
          .from(schema.citizens)
          .groupBy(sql`1`);
        return rows.map((r: any) => ({ grupo: r.ageGroup, cantidad: r.total }));
      },
    }),

    statsBySector: tool({
      description: "Obtiene estadísticas por sector de la comunidad.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            sector: schema.houses.sector,
            viviendas: count(schema.houses.id),
          })
          .from(schema.houses)
          .groupBy(schema.houses.sector)
          .orderBy(schema.houses.sector);
        return rows;
      },
    }),

    searchLaws: tool({
      description: "Busca información en las Leyes del Poder Popular.",
      inputSchema: z.object({
        query: z.string().describe("Términos de búsqueda"),
      }),
      execute: async ({ query }: { query: string }) => {
        const term = `%${query.toLowerCase()}%`;
        const rows = await db
          .select({
            name: schema.laws.name,
            pdfUrl: schema.laws.pdfUrl,
            fullText: schema.laws.fullText,
          })
          .from(schema.laws)
          .where(sql`LOWER(${schema.laws.fullText}) LIKE ${term} OR LOWER(${schema.laws.name}) LIKE ${term}`)
          .limit(3);

        if (rows.length === 0) {
          return { message: "No se encontraron leyes relacionadas." };
        }

        return rows.map((row: any) => {
          let excerpt = "";
          if (row.fullText) {
            const idx = row.fullText.toLowerCase().indexOf(query.toLowerCase());
            if (idx !== -1) {
              const start = Math.max(0, idx - 150);
              const end = Math.min(row.fullText.length, idx + 400);
              excerpt = (start > 0 ? "..." : "") + row.fullText.slice(start, end) + "...";
            }
          }
          return { ley: row.name, fragmento: excerpt, enlace: row.pdfUrl };
        });
      },
    }),
  };
}

// Endpoint de chat streaming
app.post("/chat", async (c) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const workersai = createWorkersAI({ binding: c.env.AI });

    const body = await c.req.json<{
      messages: Array<{ role: string; content: string; parts?: Array<{ type: string; text: string }> }>;
      conversationId?: string;
      userId?: string;
    }>();

    const { messages, conversationId, userId } = body;

    if (!messages || messages.length === 0) {
      return c.json({ error: "No messages provided" }, 400);
    }

    // Guardar mensaje del usuario
    if (conversationId && userId) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage?.role === "user") {
        const content = lastUserMessage.parts
          ? lastUserMessage.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
          : lastUserMessage.content;

        try {
          await db.insert(schema.messages).values({
            conversationId,
            role: "user",
            content,
          });
        } catch (e) {
          // Si falla, continuamos
        }
      }
    }

    const tools = buildTools(db);

    // Hacer streaming
    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: SYSTEM_PROMPT,
      messages: messages as any,
      tools,
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default {
  fetch: app.fetch,
};
