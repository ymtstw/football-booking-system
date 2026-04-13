/** 公開 POST: 締切前の予約取消（token）。morning_fixed を cancelled に。 */
import { NextResponse } from "next/server";

import { rateLimitReservationTokenCancel } from "@/lib/rate-limit/reservation-public";
import {
  hashReservationTokenPlain,
  isValidReservationTokenFormat,
  normalizeReservationTokenPlain,
} from "@/lib/reservations/token";
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
    return NextResponse.json(
      { error: "確認コードの形式が不正です" },
      { status: 404 }
    );
  }

  const tokenHash = hashReservationTokenPlain(token);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("cancel_public_reservation", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  const result = data as RpcResult | null;
  if (!result || typeof result !== "object") {
    return NextResponse.json(
      { error: "キャンセルの処理に失敗しました" },
      { status: 500 }
    );
  }

  if (result.success === true && result.reservationId) {
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
    case "invalid_input":
      return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
    default:
      return NextResponse.json(
        { error: "キャンセルの処理に失敗しました" },
        { status: 500 }
      );
  }
}
