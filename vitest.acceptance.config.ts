import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/acceptance/**/*.acceptance.test.ts"],
    testTimeout: 20000,
    setupFiles: ["tests/acceptance/harness/setup.ts"],
  },
});
