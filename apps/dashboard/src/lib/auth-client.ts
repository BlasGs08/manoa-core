import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/env";
import { ac, admin, superadmin, user } from "./permissions";

const defaultApiUrl = env.VITE_API_URL || "http://localhost:8787/api";
const resolvedApiOrigin = env.VITE_API_ORIGIN || new URL(defaultApiUrl).origin;

export const authClient = createAuthClient({
	baseURL: resolvedApiOrigin,
  plugins: [
    adminClient({
      ac,
      roles: {
        admin,
        user,
        superadmin,
      },
    }),
  ],
});
