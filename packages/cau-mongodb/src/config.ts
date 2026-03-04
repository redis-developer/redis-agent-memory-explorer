import { config } from "dotenv";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
  config({ path: resolve(process.cwd(), "test.env") });
} else {
  config();
}

const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017",
  MONGODB_DATABASE: process.env.MONGODB_DATABASE ?? "cauMongodb",
} as const;

export { ENV };
