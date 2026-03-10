import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  config({ path: resolve(process.cwd(), "test.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  AGENT_MEMORY_BASE_URL:
    process.env.AGENT_MEMORY_BASE_URL ?? "http://localhost:8000",
  AGENT_MEMORY_API_KEY: process.env.AGENT_MEMORY_API_KEY ?? "",
  AGENT_MEMORY_BEARER_TOKEN: process.env.AGENT_MEMORY_BEARER_TOKEN ?? "",
  AGENT_MEMORY_DEFAULT_NAMESPACE:
    process.env.AGENT_MEMORY_DEFAULT_NAMESPACE ?? "",
  AGENT_MEMORY_TIMEOUT_MS: parseInt(
    process.env.AGENT_MEMORY_TIMEOUT_MS ?? "30000",
    10,
  ),
} as const;

export { ENV };
