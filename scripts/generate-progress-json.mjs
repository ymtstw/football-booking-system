/**
 * docs/progress.md からチェック行を抽出し public/dev/progress-tasks.json を生成する。
 * 進捗トラッカー HTML 用。progress.md を編集したら npm run progress:sync を実行。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "progress.md");
const outPath = path.join(root, "public", "dev", "progress-tasks.json");

const md = fs.readFileSync(mdPath, "utf8");
const lines = md.split(/\r?\n/);

let section = "（未分類）";
const tasks = [];
const seen = new Set();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h2 = line.match(/^## (.+)$/);
  if (h2) {
    section = h2[1].trim();
    continue;
  }
  const m = line.match(/^- \[([ xX])\]\s+(.+)$/);
  if (!m) continue;
  const text = m[2].trim();
  let id = crypto.createHash("sha256").update(`${section}\0${text}`).digest("hex").slice(0, 16);
  if (seen.has(id)) id += `-${i}`;
  seen.add(id);
  tasks.push({
    id,
    section,
    text,
    defaultDone: m[1].toLowerCase() === "x",
    sourceLine: i + 1,
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  sourceFile: "docs/progress.md",
  taskCount: tasks.length,
  tasks,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Wrote ${tasks.length} tasks to public/dev/progress-tasks.json`);
