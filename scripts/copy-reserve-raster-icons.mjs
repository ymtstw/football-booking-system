/**
 * Cursor の assets にある ChatGPT 生成 PNG を
 * `public/reserve-icons-generated/` に意味のある名前でコピーする。
 *
 * 使い方:
 *   node scripts/copy-reserve-raster-icons.mjs
 *
 * 別フォルダにある場合:
 *   set RESERVE_RASTER_SOURCE=C:\path\to\assets
 *   node scripts/copy-reserve-raster-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const destDir = path.join(projectRoot, "public", "reserve-icons-generated");

const defaultSource = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-kashima-y-football-booking-system",
  "assets"
);

const sourceDir = process.env.RESERVE_RASTER_SOURCE || defaultSource;

/** 出力ファイル名 → ソースファイル名に含まれる一意の断片 */
const map = [
  ["soccer-ball.png", "__1_-abb6aafb"],
  ["envelope.png", "__2_-8f65b254"],
  ["search.png", "__3_-6f211366"],
  ["handshake.png", "__4_-afdd6dee"],
  ["cloud-rain.png", "__5_-e1c31e7b"],
  ["clipboard-info.png", "__6_-47e96bce"],
  ["info-circle.png", "__7_-d6e8e1a4"],
  ["building.png", "__8_-d2d8e810"],
  ["lock.png", "__9_-ccd1f622"],
  ["check-square.png", "__10_-dbae1a67"],
  ["calendar.png", "__11_-9a3a6f37"],
  ["calendar-soccer.png", "__12_-8978ce84"],
  ["documents.png", "__13_-54268465"],
  ["warning.png", "__14_-fdd90078"],
  ["lunch.png", "__15_-c499cd2f"],
  ["briefcase.png", "__16_-abd53e6e"],
  ["extra-17.png", "__17_-b40c4beb"],
  ["extra-18.png", "__18_-553ba792"],
];

function findSource(fragment) {
  if (!fs.existsSync(sourceDir)) return null;
  const names = fs.readdirSync(sourceDir);
  const hit = names.find(
    (n) =>
      n.endsWith(".png") &&
      n.includes("ChatGPT_Image_2026_4_17__20_48_") &&
      n.includes(fragment)
  );
  return hit ? path.join(sourceDir, hit) : null;
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error("ソースフォルダがありません:", sourceDir);
    console.error("RESERVE_RASTER_SOURCE に assets のパスを指定して再実行してください。");
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  let ok = 0;
  for (const [outName, fragment] of map) {
    const src = findSource(fragment);
    if (!src) {
      console.warn("見つかりません:", fragment, "→", outName);
      continue;
    }
    fs.copyFileSync(src, path.join(destDir, outName));
    console.log("OK", outName, "<=", path.basename(src));
    ok++;
  }
  if (ok === 0) {
    console.error("1件もコピーできませんでした。");
    process.exit(1);
  }
  console.log("完了:", ok, "件 →", destDir);
}

main();
