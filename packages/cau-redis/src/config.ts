import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  config({ path: resolve(process.cwd(), "test.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
} as const;

export { ENV };
