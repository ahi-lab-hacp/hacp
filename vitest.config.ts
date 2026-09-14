import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ahi-lab-hacp/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@ahi-lab-hacp/http": fileURLToPath(new URL("./packages/http/src/index.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      enabled: false,
      include: ["packages/{core,http}/src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 60,
        functions: 85,
        lines: 75,
        statements: 75,
      },
    },
    include: ["packages/**/*.test.ts", "conformance/**/*.test.ts"],
  },
});
