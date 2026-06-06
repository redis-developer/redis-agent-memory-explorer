import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config } from "dotenv";

// LANGCACHE_* vars live in backend/.env; shared secrets (OPENAI etc.) in root
// .env. dotenv does not override already-set keys, so load backend first.
config({ path: resolve(__dirname, "../../backend/.env") });
config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
