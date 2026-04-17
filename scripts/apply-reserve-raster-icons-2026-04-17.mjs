/**
 * 2026-04-17 透明抜きバッチ（ChatGPT_Image … __21_59_* / __22_11_*）を
 * public/reserve-icons-generated/ の正式名にコピーする。
 *
 *   node scripts/apply-reserve-raster-icons-2026-04-17.mjs
 *
 * 未送付のため既存を維持: search, documents, warning, briefcase
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const destDir = path.join(projectRoot, "public", "reserve-icons-generated");
const sourceDir = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-kashima-y-football-booking-system",
  "assets"
);

/** [出力名, ソースファイル名に含まれるユニーク断片] */
const map = [
  ["soccer-ball.png", "__21_59_54__3_-04ade010"],
  ["envelope.png", "__21_59_56__16_-79b4a07a"],
  ["handshake.png", "__21_59_52__1_-f697e6af"],
  ["cloud-rain.png", "__21_59_54__5_-2ac77523"],
  ["clipboard-info.png", "__21_59_55__9_-ad964926"],
  ["info-circle.png", "__21_59_54__6_-a78d955d"],
  ["building.png", "__21_59_55__8_-2691572e"],
  ["lock.png", "__21_59_54__7_-3a80e0f3"],
  ["check-square.png", "__21_59_55__10_-5d027186"],
  ["calendar.png", "__21_59_55__11_-e9c1b870"],
  ["calendar-soccer.png", "__22_11_03__1_-cf51b52a"],
  ["lunch.png", "__21_59_54__4_-75863d1f"],
  ["extra-17.png", "__21_59_52__2_-55fc95e2"],
  ["extra-18.png", "__22_11_03__2_-c0dc6189"],
];

const keepExisting = new Set([
  "search.png",
  "documents.png",
  "warning.png",
  "briefcase.png",
]);

function findSource(fragment) {
  if (!fs.existsSync(sourceDir)) return null;
  const names = fs.readdirSync(sourceDir).filter((n) => n.endsWith(".png"));
  const hit = names.find((n) => n.includes(fragment));
  return hit ? path.join(sourceDir, hit) : null;
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error("ソースがありません:", sourceDir);
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
  console.log(
    "\n既存維持（新アセットなし）:",
    [...keepExisting].join(", ")
  );
  console.log("完了:", ok, "件 →", destDir);
}

main();
