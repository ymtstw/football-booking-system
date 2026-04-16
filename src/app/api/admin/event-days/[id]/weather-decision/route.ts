/**
 * 雨天判断（go / cancel）の登録。`weather_decisions` に履歴を残し `event_days` を更新。
 * オプションで cancel 時のみ、参加者へ即時メール（例外運用）。
 */
import { NextResponse } from "next/server";

import { sendWeatherCancelImmediateEmailAndUpdateNotification } from "@/lib/email/day-before-final-mail";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

type DecisionBody = {
  decision?: string;
  notes?: string;
  sendImmediateCancelNotice?: boolean;
  /** `cancel` のとき: `immediate`（即時確定・既定） / `day_before_17`（前日17:00のCronで雨天中止文面） */
  delivery?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventDayId } = await context.params;
  if (!eventDayId) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as DecisionBody;
  const decisionRaw = body.decision?.trim().toLowerCase();
  const notes =
    typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const sendImmediateCancelNotice = Boolean(body.sendImmediateCancelNotice);
  const deliveryRaw =
    typeof body.delivery === "string" ? body.delivery.trim().toLowerCase() : "";
  const delivery =
    deliveryRaw === "day_before_17" || deliveryRaw === "immediate"
      ? deliveryRaw
      : "immediate";

  if (decisionRaw !== "go" && decisionRaw !== "cancel") {
    return NextResponse.json(
      { error: "decision は go または cancel を指定してください" },
      { status: 422 }
    );
  }

  if (sendImmediateCancelNotice && decisionRaw !== "cancel") {
    return NextResponse.json(
      { error: "sendImmediateCancelNotice は cancel と併用してください" },
      { status: 422 }
    );
  }

  if (delivery === "day_before_17" && decisionRaw !== "cancel") {
    return NextResponse.json(
      { error: "delivery が day_before_17 のときは cancel と併用してください" },
      { status: 422 }
    );
  }

  if (delivery === "day_before_17" && sendImmediateCancelNotice) {
    return NextResponse.json(
      { error: "前日17:00予約と即時メールは同時に指定できません" },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: ed, error: fetchErr } = await supabase
    .from("event_days")
    .select(
      "id, status, event_date, grade_band, status_before_weather_cancel, weather_day_before_rain_scheduled, final_day_before_notice_completed_at"
    )
    .eq("id", eventDayId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: fetchErr.message, code: fetchErr.code },
      { status: 500 }
    );
  }
  if (!ed) {
    return NextResponse.json({ error: "開催日が見つかりません" }, { status: 404 });
  }

  const st = ed.status as string;
  if (st === "draft") {
    return NextResponse.json(
      { error: "公開前の開催日には雨天判断を登録できません" },
      { status: 422 }
    );
  }
  if (st === "cancelled_minimum") {
    return NextResponse.json(
      { error: "最少催行中止の開催日には雨天判断を登録できません" },
      { status: 409 }
    );
  }
  if (st === "cancelled_operational") {
    return NextResponse.json(
      { error: "運営都合中止の開催日には雨天判断を登録できません" },
      { status: 409 }
    );
  }

  if (st === "cancelled_weather" && decisionRaw === "cancel") {
    return NextResponse.json(
      { error: "すでに雨天中止として登録されています" },
      { status: 409 }
    );
  }

  if (st === "cancelled_weather" && decisionRaw === "go") {
    const prev = ed.status_before_weather_cancel as string | null;
    if (prev === "confirmed") {
      return NextResponse.json(
        { error: "編成確定後に雨天中止したため、ここからは取り消せません" },
        { status: 409 }
      );
    }
  }

  if (decisionRaw === "cancel" && delivery === "day_before_17") {
    const fin = (ed as { final_day_before_notice_completed_at?: string | null })
      .final_day_before_notice_completed_at;
    if (fin) {
      return NextResponse.json(
        { error: "最終通知が完了しているため、前日17:00の雨天中止予約はできません" },
        { status: 409 }
      );
    }
    if (st !== "confirmed" && st !== "locked") {
      return NextResponse.json(
        { error: "前日17:00の雨天中止予約は、確定または締切済の開催日のみ設定できます" },
        { status: 409 }
      );
    }
  }

  const { error: insErr } = await supabase.from("weather_decisions").insert({
    event_day_id: eventDayId,
    decision: decisionRaw,
    decided_by: admin.id,
    notes,
  });

  if (insErr) {
    return NextResponse.json(
      { error: insErr.message, code: insErr.code },
      { status: 500 }
    );
  }

  if (decisionRaw === "cancel") {
    if (delivery === "day_before_17") {
      const { error: upErr } = await supabase
        .from("event_days")
        .update({
          weather_day_before_rain_scheduled: true,
          weather_status: "go",
        })
        .eq("id", eventDayId);

      if (upErr) {
        return NextResponse.json(
          { error: upErr.message, code: upErr.code },
          { status: 500 }
        );
      }
    } else {
      const { error: upErr } = await supabase
        .from("event_days")
        .update({
          weather_status: "cancel",
          status: "cancelled_weather",
          status_before_weather_cancel: st,
          weather_day_before_rain_scheduled: false,
        })
        .eq("id", eventDayId);

      if (upErr) {
        return NextResponse.json(
          { error: upErr.message, code: upErr.code },
          { status: 500 }
        );
      }
    }
  } else {
    const prevSnapshot = ed.status_before_weather_cancel as string | null;
    const nextStatus =
      st === "cancelled_weather"
        ? prevSnapshot === "open" || prevSnapshot === "locked"
          ? prevSnapshot
          : "confirmed"
        : st;

    const { error: upErr } = await supabase
      .from("event_days")
      .update({
        weather_status: "go",
        status: nextStatus,
        status_before_weather_cancel: null,
        weather_day_before_rain_scheduled: false,
      })
      .eq("id", eventDayId);

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message, code: upErr.code },
        { status: 500 }
      );
    }
  }

  let immediateSent = 0;
  let immediateSkipped = 0;
  /** 即時送信を依頼したときだけ返す（件数の意味が分かるようにする） */
  let immediateNoticeDetail:
    | {
        sent: number;
        skipped: number;
        activeReservationCount: number;
        hint?: string;
        reservationLoadError?: string;
      }
    | undefined;

  if (sendImmediateCancelNotice && decisionRaw === "cancel" && delivery === "immediate") {
    const { data: reservations, error: resErr } = await supabase
      .from("reservations")
      .select(
        `
        id,
        teams ( team_name, contact_name, contact_email )
      `
      )
      .eq("event_day_id", eventDayId)
      .eq("status", "active");

    const activeReservationCount = reservations?.length ?? 0;

    if (resErr) {
      immediateNoticeDetail = {
        sent: 0,
        skipped: 0,
        activeReservationCount: 0,
        reservationLoadError: resErr.message,
        hint: "予約一覧の取得に失敗したため、即時メールは送っていません（雨天判断の保存は完了しています）。",
      };
    } else if (activeReservationCount === 0) {
      immediateNoticeDetail = {
        sent: 0,
        skipped: 0,
        activeReservationCount: 0,
        hint: "この開催日に active な予約がないため、即時メールの送信対象がありません。",
      };
    } else {
      immediateNoticeDetail = {
        sent: 0,
        skipped: 0,
        activeReservationCount,
      };
      for (const r of reservations) {
        const reservationId = r.id as string;
        const teams = r.teams;
        const teamRow = Array.isArray(teams) ? teams[0] : teams;
        const teamName =
          teamRow && typeof teamRow === "object" && "team_name" in teamRow
            ? String((teamRow as { team_name?: string }).team_name ?? "").trim()
            : "";
        const contactName =
          teamRow && typeof teamRow === "object" && "contact_name" in teamRow
            ? String((teamRow as { contact_name?: string }).contact_name ?? "").trim()
            : "";
        const contactEmail =
          teamRow && typeof teamRow === "object" && "contact_email" in teamRow
            ? String((teamRow as { contact_email?: string }).contact_email ?? "").trim()
            : "";

        if (!contactEmail) {
          immediateSkipped += 1;
          continue;
        }

        const { data: existing } = await supabase
          .from("notifications")
          .select("id, status")
          .eq("reservation_id", reservationId)
          .eq("template_key", "weather_cancel_immediate")
          .maybeSingle();

        if (existing?.status === "sent") {
          immediateSkipped += 1;
          continue;
        }

        if (!existing) {
          const { error: nIns } = await supabase.from("notifications").insert({
            event_day_id: eventDayId,
            reservation_id: reservationId,
            channel: "email",
            status: "pending",
            template_key: "weather_cancel_immediate",
            payload_summary: { event_date: ed.event_date },
          });
          if (nIns) {
            immediateSkipped += 1;
            continue;
          }
        } else if (existing.status === "failed") {
          await supabase
            .from("notifications")
            .update({ status: "pending", error_message: null })
            .eq("id", existing.id);
        }

        await sendWeatherCancelImmediateEmailAndUpdateNotification({
          supabase,
          reservationId,
          to: contactEmail,
          contactName: contactName || "ご担当者",
          teamName: teamName || "（チーム名未設定）",
          eventDateIso: ed.event_date as string,
          gradeBand: (ed.grade_band as string) ?? null,
          weatherNotes: notes,
        });

        const { data: after } = await supabase
          .from("notifications")
          .select("status")
          .eq("reservation_id", reservationId)
          .eq("template_key", "weather_cancel_immediate")
          .maybeSingle();

        if (after?.status === "sent") immediateSent += 1;
        else immediateSkipped += 1;
      }
      immediateNoticeDetail = {
        sent: immediateSent,
        skipped: immediateSkipped,
        activeReservationCount,
        hint:
          immediateSent === 0 && immediateSkipped === 0
            ? "内部エラー: 予約はあるのに送受信カウントが更新されませんでした。"
            : immediateSent === 0 && activeReservationCount > 0
              ? "いずれも送信できませんでした（メール未設定でスキップ、既に送信済み、通知行の作成失敗など）。notifications を確認してください。"
              : undefined,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    eventDayId,
    decision: decisionRaw,
    delivery,
    immediateNotice:
      sendImmediateCancelNotice && delivery === "immediate" && immediateNoticeDetail
        ? {
            ...immediateNoticeDetail,
            sent: immediateNoticeDetail.sent,
            skipped: immediateNoticeDetail.skipped,
          }
        : undefined,
  });
}
