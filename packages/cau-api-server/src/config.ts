import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  config({ path: resolve(process.cwd(), "test.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? "3001"),
  API_PREFIX: process.env.API_PREFIX ?? "/api",
} as const;

export { ENV };
