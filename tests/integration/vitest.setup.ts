import path from "node:path";

import { config } from "dotenv";

// プロジェクト直下の .env.test（未作成なら読み込みだけスキップされ、テストは skip される）
config({ path: path.resolve(process.cwd(), ".env.test") });
