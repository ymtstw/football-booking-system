import path from "node:path";

import { defineConfig } from "vitest/config";

/** ドメイン単体テスト（DB 不要） */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
