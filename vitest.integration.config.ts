import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * ローカル Supabase 向け結合テスト。
 * 前提: `supabase start` && `supabase db reset`、プロジェクト直下に `.env.test`（tests/integration/env.test.example 参照）
 */
export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    setupFiles: ["tests/integration/vitest.setup.ts"],
    /** 同一 DB を触るため直列 */
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(
        __dirname,
        "./tests/integration/shims/server-only.ts"
      ),
    },
  },
});
