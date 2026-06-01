import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../database/schemas";
import type { getAuth } from "./auth.util";
import type { Session, User } from "better-auth";

export type Bindings = {
  DB: D1Database;
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>;
  };
  AI_MODEL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  DASHBOARD_ORIGIN?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

export type Variables = {
  db: DrizzleD1Database<typeof schema>;
  auth: ReturnType<typeof getAuth>;
  session?: {
    session: Session;
    user: User;
  } | null;
};

export type AppContext = {
  Bindings: Bindings;
  Variables: Variables;
};
