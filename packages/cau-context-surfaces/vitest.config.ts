import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    testTimeout: 60000,
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ["./vitest.setup.ts"],
  },
});

export default config;
