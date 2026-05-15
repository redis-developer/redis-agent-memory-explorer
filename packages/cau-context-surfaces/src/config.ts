import { config } from "dotenv";
import { resolve } from "node:path";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

if (isTest) {
  config({ path: resolve(process.cwd(), "../../.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  CTX_ADMIN_API_URL: process.env.CTX_ADMIN_API_URL ?? "",
  CTX_MCP_URL: process.env.CTX_MCP_URL ?? "",
  CTX_ADMIN_KEY: process.env.CTX_ADMIN_KEY ?? "",
  MCP_AGENT_KEY: process.env.MCP_AGENT_KEY ?? "",
  CTX_SURFACE_ID: process.env.CTX_SURFACE_ID ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
} as const;

export { ENV };
