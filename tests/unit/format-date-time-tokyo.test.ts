import { describe, expect, it } from "vitest";

import { formatDateTimeTokyo } from "@/lib/dates/format-jp-display";

describe("formatDateTimeTokyo", () => {
  it("UTC の ISO を Asia/Tokyo の暦表示に変換する（+9h）", () => {
    const ja = formatDateTimeTokyo("2024-06-15T03:30:45.000Z");
    expect(ja).toContain("2024");
    expect(ja).toContain("6");
    expect(ja).toContain("15");
    // UTC 03:30 → JST 12:30
    expect(ja).toMatch(/12[^\d]?30[^\d]?45/);
  });

  it("不正な文字列はトリムした入力をそのまま返す", () => {
    expect(formatDateTimeTokyo("not-a-date")).toBe("not-a-date");
  });
});
