import { NextResponse } from "next/server";

import {
  ADMIN_API_DB_ERROR_JA,
  logAdminApiDbError,
} from "@/lib/admin/admin-api-db-error";
import { getAdminUser } from "@/lib/auth/require-admin";
import { sendReservationUserCancelledEmail } from "@/lib/email/reservation-user-cancel-mail";
import { createServiceRoleClient } from "@/lib/supabase/service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcResult = {
  success?: boolean;
  error?: string;
  reservationId?: string;
  alreadyCancelled?: boolean;
};

/**
 * 管理: 予約取消（公開取消 RPC と同一ルール）。
 * `cancel_public_reservation` を reservation_token_hash で実行する。
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID が不正です" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: hashRow, error: hashErr } = await supabase
    .from("reservations")
    .select("reservation_token_hash")
    .eq("id", id)
    .maybeSingle();

  if (hashErr || !hashRow?.reservation_token_hash) {
    if (hashErr) {
      logAdminApiDbError("POST /api/admin/reservations/[id]/cancel fetch hash", hashErr);
      return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
    }
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  const tokenHash = String(hashRow.reservation_token_hash).trim();

  const { data, error } = await supabase.rpc("cancel_public_reservation", {
    p_token_hash: tokenHash,
  });

  if (error) {
    logAdminApiDbError("POST /api/admin/reservations/[id]/cancel rpc", error);
    return NextResponse.json({ error: ADMIN_API_DB_ERROR_JA }, { status: 500 });
  }

  const result = data as RpcResult | null;
  if (!result || typeof result !== "object") {
    return NextResponse.json(
      { error: "キャンセルの処理に失敗しました" },
      { status: 500 }
    );
  }

  if (result.success === true && result.reservationId) {
    if (result.alreadyCancelled !== true) {
      const rid = String(result.reservationId);
      const { data: mailRow } = await supabase
        .from("reservations")
        .select(
          "public_ref, event_days(event_date), teams(contact_name, team_name, contact_email)"
        )
        .eq("id", rid)
        .maybeSingle();

      if (mailRow) {
        const row = mailRow as {
          public_ref: string | null;
          event_days: { event_date: string } | { event_date: string }[] | null;
          teams:
            | { contact_name: string; team_name: string; contact_email: string }
            | { contact_name: string; team_name: string; contact_email: string }[]
            | null;
        };
        const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
        const ed = Array.isArray(row.event_days) ? row.event_days[0] : row.event_days;
        if (team?.contact_email?.trim()) {
          void sendReservationUserCancelledEmail({
            to: team.contact_email.trim(),
            contactName: team.contact_name.trim(),
            teamName: team.team_name.trim(),
            publicRef: row.public_ref?.trim() ?? null,
            eventDateIso: ed?.event_date ?? null,
          });
        }
      }
    }

    return NextResponse.json({
      reservationId: result.reservationId,
      cancelled: true,
      alreadyCancelled: result.alreadyCancelled === true,
    });
  }

  const err = result.error ?? "unknown";
  switch (err) {
    case "not_found":
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    case "deadline_passed":
      return NextResponse.json(
        { error: "締切を過ぎているためキャンセルできません" },
        { status: 409 }
      );
    case "event_not_open":
      return NextResponse.json(
        { error: "受付を終了したため、キャンセルできません" },
        { status: 409 }
      );
    case "invalid_input":
      return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
    default:
      return NextResponse.json(
        { error: "キャンセルの処理に失敗しました" },
        { status: 500 }
      );
  }
}
