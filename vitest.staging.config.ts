import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * デプロイ済み Staging への HTTP スモーク（Master_TestSpec / MVP_Minimum_Run のうち再現しやすい項目）。
 * 前提: `STAGING_BASE_URL`（末尾スラッシュなし）。管理 API 用は任意で `STAGING_ADMIN_COOKIE`。
 */
export default defineConfig({
  test: {
    name: "staging",
    environment: "node",
    include: ["tests/staging/**/*.staging.test.ts"],
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
