import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
    setupFiles: ["./vitest.setup.ts"],
  },
});

export default config;
