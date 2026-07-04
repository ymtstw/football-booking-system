/**
 * 公開 POST: 予約取消（token）。morning_fixed を cancelled に。
 * RPC が `event_days.status = open` かつ締切前を検証（締切と locked は別概念。仕様は docs/spec を参照）。
 */
import { NextResponse } from "next/server";

import { sendReservationUserCancelledEmail } from "@/lib/email/reservation-user-cancel-mail";
import { recordReservationTokenLookupFailure } from "@/lib/rate-limit/reservation-token-lookup-failure";
import { rateLimitReservationTokenCancel } from "@/lib/rate-limit/reservation-public";
import { RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA } from "@/lib/reservations/reservation-token-auth-message";
import {
  hashReservationTokenPlain,
  isValidReservationTokenFormat,
  normalizeReservationTokenPlain,
} from "@/lib/reservations/token";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_WRITE_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { revalidatePublicReserveCaches } from "@/lib/event-days/public-reserve-cache";
import { createServiceRoleClient } from "@/lib/supabase/service";

type RpcResult = {
  success?: boolean;
  error?: string;
  reservationId?: string;
  alreadyCancelled?: boolean;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const limited = rateLimitReservationTokenCancel(request);
  if (limited) return limited;

  const { token: rawToken } = await context.params;
  const token = normalizeReservationTokenPlain(rawToken ?? "");

  if (!isValidReservationTokenFormat(token)) {
    const block = recordReservationTokenLookupFailure(request);
    if (block) return block;
    return NextResponse.json({ error: RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA }, { status: 404 });
  }

  const tokenHash = hashReservationTokenPlain(token);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("cancel_public_reservation", {
    p_token_hash: tokenHash,
  });

  if (error) {
    logPublicReserveApiSupabaseError(
      "POST /api/reservations/[token]/cancel cancel_public_reservation",
      error
    );
    return NextResponse.json({ error: PUBLIC_RESERVE_API_WRITE_ERROR_JA }, { status: 500 });
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
      // 有効予約が減り残数が変わったので公開表示のキャッシュを無効化
      revalidatePublicReserveCaches();
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
      cancelled: true,
      alreadyCancelled: result.alreadyCancelled === true,
    });
  }

  const err = result.error ?? "unknown";
  switch (err) {
    case "not_found": {
      const block = recordReservationTokenLookupFailure(request);
      if (block) return block;
      return NextResponse.json({ error: RESERVATION_CONFIRM_CODE_AUTH_ERROR_JA }, { status: 404 });
    }
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
