import path from "node:path";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname);
// 既定 URL はリポジトリ同梱の example。秘匿値は .env.staging で上書き（任意）。
loadEnv({ path: path.join(root, ".env.staging.example") });
loadEnv({ path: path.join(root, ".env.staging") });

/**
 * デプロイ済み Staging への HTTP スモーク（Master_TestSpec / MVP_Minimum_Run のうち再現しやすい項目）。
 * 前提: `STAGING_BASE_URL`（末尾スラッシュなし）。管理 API 用は任意で `STAGING_ADMIN_COOKIE`。
 * 環境変数: `.env.staging.example` → `.env.staging` の順で dotenv 読込（tests/staging のコメント参照）。
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
