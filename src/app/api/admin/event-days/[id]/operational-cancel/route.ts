/**
 * 運営都合による開催中止（雨天判断とは別）。`event_days.status = cancelled_operational` と
 * `operational_cancellation_notice` を保存。オプションで即時メール（`operational_cancel_immediate`）。
 */
import { NextResponse } from "next/server";

import { sendOperationalCancelImmediateEmailAndUpdateNotification } from "@/lib/email/day-before-final-mail";
import { getAdminUser } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/service";

const NOTICE_MAX = 4000;

type Body = {
  /** 参加者向けメールに載せる文言（必須） */
  participantNotice?: string;
  sendImmediateOperationalNotice?: boolean;
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

  const body = json as Body;
  const noticeRaw =
    typeof body.participantNotice === "string" ? body.participantNotice.trim() : "";
  const sendImmediate = Boolean(body.sendImmediateOperationalNotice);

  if (!noticeRaw) {
    return NextResponse.json(
      { error: "participantNotice（参加者向けのお知らせ文）を入力してください" },
      { status: 422 }
    );
  }
  if (noticeRaw.length > NOTICE_MAX) {
    return NextResponse.json(
      { error: `お知らせ文は ${NOTICE_MAX} 文字以内にしてください` },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  const { data: ed, error: fetchErr } = await supabase
    .from("event_days")
    .select("id, status, event_date, grade_band")
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
      { error: "公開前の開催日には緊急中止を登録できません" },
      { status: 422 }
    );
  }
  if (st === "cancelled_minimum") {
    return NextResponse.json(
      { error: "最少催行中止の開催日には緊急中止を登録できません" },
      { status: 409 }
    );
  }
  if (st === "cancelled_weather") {
    return NextResponse.json(
      { error: "雨天中止が登録済みです。運営中止は登録できません" },
      { status: 409 }
    );
  }
  if (st === "cancelled_operational") {
    return NextResponse.json(
      { error: "すでに運営都合中止として登録されています" },
      { status: 409 }
    );
  }

  if (st !== "open" && st !== "locked" && st !== "confirmed") {
    return NextResponse.json(
      { error: "この状態からは運営都合中止を登録できません" },
      { status: 409 }
    );
  }

  const { error: upErr } = await supabase
    .from("event_days")
    .update({
      status: "cancelled_operational",
      operational_cancellation_notice: noticeRaw,
      status_before_operational_cancel: st,
    })
    .eq("id", eventDayId);

  if (upErr) {
    return NextResponse.json(
      { error: upErr.message, code: upErr.code },
      { status: 500 }
    );
  }

  let immediateSent = 0;
  let immediateSkipped = 0;
  let immediateNoticeDetail:
    | {
        sent: number;
        skipped: number;
        activeReservationCount: number;
        hint?: string;
        reservationLoadError?: string;
      }
    | undefined;

  if (sendImmediate) {
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
        hint: "予約一覧の取得に失敗したため、即時メールは送っていません（緊急中止の保存は完了しています）。",
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
          .eq("template_key", "operational_cancel_immediate")
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
            template_key: "operational_cancel_immediate",
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

        await sendOperationalCancelImmediateEmailAndUpdateNotification({
          supabase,
          reservationId,
          to: contactEmail,
          contactName: contactName || "ご担当者",
          teamName: teamName || "（チーム名未設定）",
          eventDateIso: ed.event_date as string,
          gradeBand: (ed.grade_band as string) ?? null,
          operationalNotice: noticeRaw,
        });

        const { data: after } = await supabase
          .from("notifications")
          .select("status")
          .eq("reservation_id", reservationId)
          .eq("template_key", "operational_cancel_immediate")
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
    immediateNotice:
      sendImmediate && immediateNoticeDetail
        ? {
            ...immediateNoticeDetail,
            sent: immediateNoticeDetail.sent,
            skipped: immediateNoticeDetail.skipped,
          }
        : undefined,
  });
}
