/** ローカル用: .env.local の CRON_SECRET 行の有無と値の長さだけ表示（値は出さない） */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = path.join(root, ".env.local");
if (!fs.existsSync(p)) {
  console.log("結果: .env.local が見つかりません（パス: " + p + "）");
  process.exit(0);
}
const text = fs.readFileSync(p, "utf8");
const lines = text.split(/\r?\n/).filter((l) => /^CRON_SECRET\s*=/.test(l));
console.log("CRON_SECRET 行の数:", lines.length);
if (!lines[0]) {
  console.log("結果: CRON_SECRET= の行がありません");
  process.exit(0);
}
let v = lines[0].split("=").slice(1).join("=").trim();
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}
console.log("値の文字数（引用符除く）:", v.length);
console.log(
  v.length >= 16
    ? "結果: 長さは要件を満たしています。dev 再起動後も 503 なら別要因を疑ってください。"
    : "結果: 16 文字未満です。長いランダム文字列にしてください。"
);
