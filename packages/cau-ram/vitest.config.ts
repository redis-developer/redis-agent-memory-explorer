import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config } from "dotenv";

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
