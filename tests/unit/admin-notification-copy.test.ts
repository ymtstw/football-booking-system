import { describe, expect, it } from "vitest";

import { eventDayStatusLabelJa } from "@/app/admin/(protected)/event-days/event-day-status-label";
import {
  notificationTemplateLabelJa,
  summarizeOutboundEmailError,
} from "@/lib/admin/notification-failed-display";

describe("notificationTemplateLabelJa（管理画面・業務用語）", () => {
  it("主要な template_key は日本語ラベルにマップされる", () => {
    expect(notificationTemplateLabelJa("reservation_created")).toBe("予約完了メール");
    expect(notificationTemplateLabelJa("day_before_final")).toBe("前日最終案内");
    expect(notificationTemplateLabelJa("matching_proposal")).toBe("対戦案内");
    expect(notificationTemplateLabelJa("minimum_cancel_notice")).toBe("最少催行中止のお知らせ");
    expect(notificationTemplateLabelJa("weather_cancel_immediate")).toBe("雨天中止（即時）");
    expect(notificationTemplateLabelJa("operational_cancel_immediate")).toBe("運営中止（即時）");
    expect(notificationTemplateLabelJa("morning_slot_force_changed")).toBe(
      "朝枠・時刻変更のお知らせ"
    );
  });

  it("未知のキーは内部名をそのまま出さず「その他のメール」", () => {
    expect(notificationTemplateLabelJa("unknown_internal_key")).toBe("その他のメール");
  });

  it("空は種別なし", () => {
    expect(notificationTemplateLabelJa(null)).toBe("（種別なし）");
    expect(notificationTemplateLabelJa("")).toBe("（種別なし）");
  });
});

describe("summarizeOutboundEmailError（現場向け短文）", () => {
  it("空は理由なし", () => {
    expect(summarizeOutboundEmailError(null).summaryJa).toBe("理由は記録されていません。");
    expect(summarizeOutboundEmailError("   ").rawDetail).toBeNull();
  });

  it("短い日本語主体はそのまま（原文折りたたみ不要）", () => {
    const ja = "送信サービス側の一時的なエラーです。";
    const r = summarizeOutboundEmailError(ja);
    expect(r.summaryJa).toBe(ja);
    expect(r.rawDetail).toBeNull();
  });

  it("英語主体は短い要約にし原文は別", () => {
    const r = summarizeOutboundEmailError("Error: SMTP connection refused");
    expect(r.summaryJa).toBe(
      "送信できませんでした。"
    );
    expect(r.rawDetail).toBe("Error: SMTP connection refused");
  });
});

describe("eventDayStatusLabelJa", () => {
  it("既知ステータスは業務ラベル", () => {
    expect(eventDayStatusLabelJa("locked")).toBe("受付終了");
    expect(eventDayStatusLabelJa("confirmed")).toBe("開催確定");
  });

  it("未知は要確認（raw enum を画面に出さない）", () => {
    expect(eventDayStatusLabelJa("future_unknown_status")).toBe("要確認");
  });
});
