import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { count } from 'drizzle-orm'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import * as schema from "./shared/database/schemas"
import housesRouter from './modules/house/house.router'
import familiesRouter from './modules/family/family.router'
import citizensRouter from './modules/citizen/citizen.router'
import reportsRouter from './modules/reports/reports.router'
import aiRouter from './modules/ai/ai.router'
import { pollsRouter } from './modules/polls/polls.router'
import documentsRouter from './modules/documents/documents.router'
import certificationsRouter from './modules/certifications/index'
import { logger } from 'hono/logger'
import { etag } from 'hono/etag'
import { getAuth } from './shared/utils/auth.util'
import { ChatAgent } from './modules/ai/chat-agent'
import { routeAgentRequest } from 'agents'
import { seedRouter } from './modules/seed';
import { requestsRouter } from './modules/requests/requests.router';
import validationsRouter from './modules/validations/validations.router';
import { signatoriesRouter } from './modules/signatories/signatories.router';
import lawsRouter from './modules/laws/laws.router';
import { scrapeAndStoreLaws } from './modules/laws/laws.scraper';
import { settingsRouter } from './modules/settings';
import { statsRouter } from './modules/stats';

type Bindings = {
  DB: D1Database
  BETTER_AUTH_SECRET: string | { get: () => Promise<string> };
  TURNSTILE_SECRET_KEY?: string | { get: () => Promise<string> };
  RESEND_API_KEY?: string | { get: () => Promise<string> };
  BOOTSTRAP_ADMIN_KEY?: string | { get: () => Promise<string> };
  CF_ACCOUNT_ID: string | { get: () => Promise<string> };
  CF_BR_API_TOKEN: string | { get: () => Promise<string> };
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  AI_MODEL?: string
  APP_CEDULA_ID?: string;
  APP_CEDULA_TOKEN?: string;
  BETTER_AUTH_URL?: string;
  DASHBOARD_ORIGIN?: string;
  RESEND_FROM_EMAIL?: string;
  ChatAgent: DurableObjectNamespace;
  LAWS_SCRAPE_QUEUE: Queue<LawsScrapeMessage>;
}

type LawsScrapeMessage = {
  type: "scrape_laws";
}

type RuntimeSecrets = {
  betterAuthSecret: string
  resendApiKey?: string
  turnstileSecret?: string
  bootstrapAdminKey?: string
}

type Variables = {
  db: DrizzleD1Database<typeof schema>
  auth: ReturnType<typeof getAuth>
  runtimeSecrets: RuntimeSecrets
  session?: unknown
}

export type HonoConfig = { Bindings: Bindings, Variables: Variables };

const DEFAULT_DASHBOARD_ORIGIN = "http://localhost:3000";

const PAGES_PREVIEW_PATTERN = /^https:\/\/[a-z0-9]+\.manoa-backoffice\.pages\.dev$/;

const isAllowedOrigin = (origin: string, dashboardOrigin: string): boolean => {
  if (origin === dashboardOrigin) return true;
  if (origin === DEFAULT_DASHBOARD_ORIGIN) return true;
  if (PAGES_PREVIEW_PATTERN.test(origin)) return true;
  return false;
};

const resolveAuthBaseUrl = (envBaseUrl: string | undefined, requestUrl: string) => {
  const requestOrigin = new URL(requestUrl).origin;

  if (!envBaseUrl) {
    return `${requestOrigin}/api/auth`;
  }

  const normalized = envBaseUrl.replace(/\/+$/, "");

  if (normalized.endsWith("/api/auth")) {
    return normalized;
  }

  return `${normalized}/api/auth`;
};

const isSecretsStoreBinding = (
  value: unknown,
): value is { get: () => Promise<string> } => {
  return typeof value === "object"
    && value !== null
    && "get" in value
    && typeof (value as { get?: unknown }).get === "function";
};

const resolveSecret = async (
  value: string | { get: () => Promise<string> } | undefined,
) => {
  if (typeof value === "string") {
    return value;
  }

  if (isSecretsStoreBinding(value)) {
    try {
      return await value.get();
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const runtimeSecretsCache = new WeakMap<Bindings, Promise<RuntimeSecrets>>();

const resolveRuntimeSecrets = (env: Bindings) => {
  const cached = runtimeSecretsCache.get(env);

  if (cached) {
    return cached;
  }

  const resolver = (async () => {
    const betterAuthSecret = await resolveSecret(env.BETTER_AUTH_SECRET);
    const resendApiKey = await resolveSecret(env.RESEND_API_KEY);
    const turnstileSecret = await resolveSecret(env.TURNSTILE_SECRET_KEY);
    const bootstrapAdminKey = await resolveSecret(env.BOOTSTRAP_ADMIN_KEY);

    const missingRequired: string[] = [];

    if (!betterAuthSecret) {
      missingRequired.push("BETTER_AUTH_SECRET");
    }

    if (missingRequired.length > 0) {
      throw new Error(`Faltan secretos requeridos: ${missingRequired.join(", ")}`);
    }

    return {
      betterAuthSecret,
      resendApiKey,
      turnstileSecret,
      bootstrapAdminKey,
    };
  })();

  runtimeSecretsCache.set(env, resolver);
  return resolver;
};

// TURNSTILE DESACTIVADO TEMPORALMENTE
// const verifyTurnstileToken = async (
//   secret: string,
//   token: string,
//   remoteIp?: string,
// ) => {
//   const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body: new URLSearchParams({ secret, response: token, remoteip: remoteIp ?? "" }),
//   });
//   if (!response.ok) return false;
//   const data = await response.json<{ success?: boolean }>();
//   return Boolean(data.success);
// };

const requireAuth: MiddlewareHandler<HonoConfig> = async (c, next) => {
  const auth = c.get("auth");
  const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
  const session = "data" in (sessionData as Record<string, unknown>)
    ? (sessionData as { data?: { session?: unknown, user?: unknown } | null }).data
    : (sessionData as { session?: unknown, user?: unknown } | null);

  if (!session?.session) {
    return c.json({ message: "No autorizado" }, 401);
  }

  c.set("session", session);

  await next();
};

const app = new Hono<HonoConfig>()
  .basePath("/api")
  .use(async (c, next) => {
    const dashboardOrigin = c.env.DASHBOARD_ORIGIN ?? DEFAULT_DASHBOARD_ORIGIN;
    return cors({
      origin: (origin) => {
        if (!origin) return "*";
        return isAllowedOrigin(origin, dashboardOrigin) ? origin : null;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Turnstile-Token", "X-Bootstrap-Key"],
      exposeHeaders: ["Content-Disposition", "Content-Type"],
    })(c, next);
  })
  .use(etag(), logger())
  .use('*', async (c, next) => {
    const db = drizzle(c.env.DB, { schema });
    const dashboardOrigin = c.env.DASHBOARD_ORIGIN ?? DEFAULT_DASHBOARD_ORIGIN;
    const requestOrigin = new URL(c.req.url).origin;
    let runtimeSecrets: RuntimeSecrets;

    try {
      runtimeSecrets = await resolveRuntimeSecrets(c.env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Configuración de secretos inválida";
      return c.json({ message }, 503);
    }

    const requestHeader = c.req.header("Origin");
    const trustedOrigins = [dashboardOrigin, requestOrigin];
    if (requestHeader && !trustedOrigins.includes(requestHeader) && PAGES_PREVIEW_PATTERN.test(requestHeader)) {
      trustedOrigins.push(requestHeader);
    }

    const auth = getAuth({
      d1: c.env.DB,
      secret: runtimeSecrets.betterAuthSecret,
      baseURL: resolveAuthBaseUrl(c.env.BETTER_AUTH_URL, c.req.url),
      resendApiKey: runtimeSecrets.resendApiKey,
      resendFromEmail: c.env.RESEND_FROM_EMAIL,
      trustedOrigins,
    });

    c.set('db', db);
    c.set('auth', auth);
    c.set('runtimeSecrets', runtimeSecrets);

    await next();
  })
  .use('/auth/sign-in/email', async (_c, next) => {
    // TURNSTILE DESACTIVADO TEMPORALMENTE
    await next();

    // if (c.req.method !== "POST") {
    //   await next();
    //   return;
    // }

    // const { turnstileSecret } = c.get("runtimeSecrets");

    // if (!turnstileSecret) {
    //   await next();
    //   return;
    // }

    // const turnstileToken = c.req.header("X-Turnstile-Token");

    // if (!turnstileToken) {
    //   return c.json({ message: "Captcha requerido" }, 400);
    // }

    // const isValid = await verifyTurnstileToken(
    //   turnstileSecret,
    //   turnstileToken,
    //   c.req.header("CF-Connecting-IP"),
    // );

    // if (!isValid) {
    //   return c.json({ message: "Captcha inválido" }, 400);
    // }

    // await next();
  })
  .use('/auth/sign-up/email', async (c, next) => {
    if (c.req.method !== "POST") {
      await next();
      return;
    }

    const db = c.get("db");
    const [result] = await db.select({ total: count() }).from(schema.user);

    if ((result?.total ?? 0) > 0) {
      return c.json({ message: "Registro público deshabilitado" }, 403);
    }

    const { bootstrapAdminKey: bootstrapKey } = c.get("runtimeSecrets");

    if (!bootstrapKey) {
      return c.json({ message: "Bootstrap no configurado" }, 503);
    }

    const requestBootstrapKey = c.req.header("X-Bootstrap-Key");

    if (!requestBootstrapKey || requestBootstrapKey !== bootstrapKey) {
      return c.json({ message: "Clave de bootstrap inválida" }, 401);
    }

    await next();
  })
  .on(["GET", "POST", "OPTIONS"], '/auth/*', async (c) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    const auth = c.get('auth');
    return auth.handler(c.req.raw);
  })
  .use('/houses/*', requireAuth)
  .use('/families/*', requireAuth)
  .use('/citizens/*', requireAuth)
  .use('/ai/*', requireAuth)
  .use('/polls/*', requireAuth)
  .use('/reports/*', requireAuth)
  .use('/documents/*', async (c, next) => {
    if (c.req.method === 'POST') {
      return requireAuth(c, next)
    }
    await next()
  })
  .route('/houses', housesRouter)
  .route('/families', familiesRouter)
  .route('/citizens', citizensRouter)
  .route('/ai', aiRouter)
  .route('/polls', pollsRouter)
  .route('/reports', reportsRouter)
  .route('/documents', documentsRouter)
  .route('/seed', seedRouter)
  .use('/requests/*', requireAuth)
  .route('/requests', requestsRouter)
  .use('/signatories/*', async (c, next) => {
    // GET /signatories is public (needed for PDF preview), PUT requires auth
    if (c.req.method !== 'GET') {
      return requireAuth(c, next);
    }
    await next();
  })
  .route('/signatories', signatoriesRouter)
  .use('/validations/*', requireAuth)
  .route('/validations', validationsRouter)
  .use('/laws/scrape', requireAuth)
  .route('/laws', lawsRouter)
  .use('/settings/*', requireAuth)
  .route('/settings', settingsRouter)
  .use('/stats/*', requireAuth)
  .route('/stats', statsRouter);

export { ChatAgent }

const handler = {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1. Rutas normales de Hono primero (/api/*)
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }

    // 2. Preflight OPTIONS para rutas de agentes
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Agent-Auth",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      }
    }

    // 3. Ruta de agentes (WebSocket + HTTP)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      if (agentResponse.status === 101) {
        return agentResponse;
      }

      const origin = request.headers.get("Origin") || "*";
      const response = new Response(agentResponse.body, agentResponse);
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      return response;
    }

    return new Response("Not found", { status: 404 });
  },

  async queue(batch: MessageBatch<LawsScrapeMessage>, env: Bindings): Promise<void> {
    const db = drizzle(env.DB, { schema });
    const accountId = typeof env.CF_ACCOUNT_ID === "string"
      ? env.CF_ACCOUNT_ID
      : await env.CF_ACCOUNT_ID.get();
    const apiToken = typeof env.CF_BR_API_TOKEN === "string"
      ? env.CF_BR_API_TOKEN
      : await env.CF_BR_API_TOKEN.get();

    for (const message of batch.messages) {
      if (message.body.type === "scrape_laws") {
        try {
          const result = await scrapeAndStoreLaws(db, accountId, apiToken);
          console.log(`[laws-queue] Completado: ${result.scraped} leyes procesadas. Errores: ${result.errors.length}`);
          if (result.errors.length > 0) {
            console.warn("[laws-queue] Errores:", result.errors);
          }
          message.ack();
        } catch (err) {
          console.error("[laws-queue] Error en scrape:", err);
          message.retry();
        }
      } else {
        message.ack();
      }
    }
  }
};

export default handler

export type AppType = typeof app
