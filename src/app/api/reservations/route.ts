/**
 * 公開 POST: 予約作成（認証不要）。RPC で TX＋行ロック。token 平文はレスポンスのみ。
 * 受付可否: `create_public_reservation` が `event_days.status = open` かつ締切前を検証する。
 * 仕様の正本: `docs/spec/implemented-behavior-catalog.md` §1
 */
import { NextResponse } from "next/server";

import { sendReservationCreatedEmailAndUpdateNotification } from "@/lib/email/reservation-created-mail";
import {
  lunchItemsToRpcJson,
  parseLunchItemsInput,
  type ParsedLunchItem,
} from "@/lib/lunch/parse-lunch-items-body";
import {
  logPublicReserveApiSupabaseError,
  PUBLIC_RESERVE_API_WRITE_ERROR_JA,
} from "@/lib/http/public-reserve-api-error";
import { rateLimitReservationCreate } from "@/lib/rate-limit/reservation-public";
import {
  formatReservationConfirmationDisplay,
  generateReservationConfirmationRaw,
} from "@/lib/reservations/confirmation-code";
import { generateReservationPublicRef } from "@/lib/reservations/public-ref";
import { hashReservationTokenPlain } from "@/lib/reservations/reservation-token-hash";
import { revalidatePublicReserveCaches } from "@/lib/event-days/public-reserve-cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  exceedsReserveCountMaxAllowed,
  RESERVE_COUNT_MAX_ALLOWED,
} from "@/lib/reservations/reserve-numeric-sanity";
import {
  isContactPhoneDigitsValid,
  normalizeContactPhoneDigits,
} from "@/lib/validators/contact-phone";
import {
  isReserveContactNameOk,
  RESERVE_CONTACT_NAME_MAX_CHARS,
} from "@/lib/validators/reserve-contact-name";

type RpcResult = {
  success?: boolean;
  error?: string;
  message?: string;
  reservationId?: string;
  teamId?: string;
};

type TeamInput = {
  teamName?: string;
  strengthCategory?: string;
  /** 1〜6（開催日の学年帯に含まれる学年） */
  representativeGradeYear?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

function parseBody(raw: unknown): {
  eventDayId: string;
  selectedMorningSlotId: string;
  team: TeamInput;
  participantCount: number;
  lunchItems: ParsedLunchItem[] | null;
} | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const eventDayId = typeof o.eventDayId === "string" ? o.eventDayId.trim() : "";
  const selectedMorningSlotId =
    typeof o.selectedMorningSlotId === "string"
      ? o.selectedMorningSlotId.trim()
      : "";
  const team =
    o.team !== null && typeof o.team === "object"
      ? (o.team as Record<string, unknown>)
      : null;
  if (!team) return null;
  const participantCount =
    typeof o.participantCount === "number" && Number.isFinite(o.participantCount)
      ? o.participantCount
      : NaN;
  const lunchItems = parseLunchItemsInput(o.lunchItems);

  return {
    eventDayId,
    selectedMorningSlotId,
    team: {
      teamName: typeof team.teamName === "string" ? team.teamName : undefined,
      strengthCategory:
        typeof team.strengthCategory === "string"
          ? team.strengthCategory
          : undefined,
      representativeGradeYear:
        typeof team.representativeGradeYear === "number" &&
        Number.isInteger(team.representativeGradeYear)
          ? team.representativeGradeYear
          : undefined,
      contactName:
        typeof team.contactName === "string" ? team.contactName : undefined,
      contactEmail:
        typeof team.contactEmail === "string" ? team.contactEmail : undefined,
      contactPhone:
        typeof team.contactPhone === "string" ? team.contactPhone : undefined,
    },
    participantCount,
    lunchItems,
  };
}

function mapRpcError(error: string): { status: number; body: Record<string, string> } {
  switch (error) {
    case "event_not_found":
    case "slot_invalid":
      return { status: 404, body: { error: "対象が見つかりません" } };
    case "event_not_open":
    case "deadline_passed":
      return { status: 409, body: { error: "現在は予約を受け付けていません" } };
    case "slot_locked":
    case "slot_full":
    case "day_full":
      return {
        status: 409,
        body: {
          error: "申し訳ございません。予約枠が埋まりました。",
          code: "day_full",
        },
      };
    case "team_inactive":
      return {
        status: 409,
        body: { error: "このチーム情報では予約できません（無効化されています）" },
      };
    case "invalid_strength":
      return {
        status: 422,
        body: { error: "チームカテゴリはストロングまたはポテンシャルを選んでください" },
      };
    case "invalid_input":
      return { status: 400, body: { error: "入力内容を確認してください" } };
    case "token_collision":
      return { status: 409, body: { error: "もう一度お試しください" } };
    default:
      return { status: 500, body: { error: "予約の処理に失敗しました" } };
  }
}

export async function POST(request: Request) {
  const limited = rateLimitReservationCreate(request);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  const parsed = parseBody(json);
  if (!parsed) {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const {
    eventDayId,
    selectedMorningSlotId,
    team,
    participantCount,
    lunchItems,
  } = parsed;

  if (!eventDayId || !selectedMorningSlotId) {
    return NextResponse.json(
      { error: "eventDayId と selectedMorningSlotId が必要です" },
      { status: 400 }
    );
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(eventDayId) || !uuidRe.test(selectedMorningSlotId)) {
    return NextResponse.json({ error: "UUID の形式が不正です" }, { status: 422 });
  }

  if (
    !team.teamName?.trim() ||
    !team.contactName?.trim() ||
    !team.contactEmail?.trim() ||
    !team.contactPhone?.trim()
  ) {
    return NextResponse.json(
      { error: "チーム名・チーム代表者名・メール・電話は必須です" },
      { status: 400 }
    );
  }

  if (!isReserveContactNameOk(team.contactName.trim())) {
    return NextResponse.json(
      {
        error: `チーム代表者名は${RESERVE_CONTACT_NAME_MAX_CHARS}文字以内で入力してください`,
      },
      { status: 422 }
    );
  }

  if (!team.strengthCategory || !["strong", "potential"].includes(team.strengthCategory)) {
    return NextResponse.json(
      { error: "チームカテゴリはストロングまたはポテンシャルを選んでください" },
      { status: 422 }
    );
  }

  const gradeYear = team.representativeGradeYear;
  if (
    gradeYear == null ||
    !Number.isInteger(gradeYear) ||
    gradeYear < 1 ||
    gradeYear > 6
  ) {
    return NextResponse.json(
      { error: "代表学年は1年〜6年から選んでください" },
      { status: 422 }
    );
  }

  if (!Number.isInteger(participantCount) || participantCount < 1) {
    return NextResponse.json(
      { error: "participantCount は 1 以上の整数にしてください" },
      { status: 400 }
    );
  }

  if (exceedsReserveCountMaxAllowed(participantCount)) {
    return NextResponse.json(
      {
        error: `参加人数は ${RESERVE_COUNT_MAX_ALLOWED} 以下の整数にしてください`,
      },
      { status: 422 }
    );
  }

  if (lunchItems === null) {
    return NextResponse.json(
      {
        error:
          "lunchItems は [{ menuItemId, quantity }] の配列で送ってください（昼食なしは空配列）",
      },
      { status: 400 }
    );
  }

  if (
    lunchItems.length > 0 &&
    lunchItems.every((item) => item.quantity === 0)
  ) {
    return NextResponse.json(
      {
        error: "昼食は、必ずご予約が必要です。",
      },
      { status: 422 }
    );
  }

  const lunchTotalUnits = lunchItems.reduce((s, item) => s + item.quantity, 0);
  if (exceedsReserveCountMaxAllowed(lunchTotalUnits)) {
    return NextResponse.json(
      {
        error: `昼食の食数の合計は ${RESERVE_COUNT_MAX_ALLOWED} 以下にしてください`,
      },
      { status: 422 }
    );
  }

  const phoneDigits = normalizeContactPhoneDigits(team.contactPhone!.trim());
  if (!isContactPhoneDigitsValid(phoneDigits)) {
    return NextResponse.json(
      {
        error:
          "電話番号は数字のみ、10〜15桁で入力してください（ハイフンは不要です。全角数字は半角に直して保存します）",
      },
      { status: 422 }
    );
  }

  const supabase = createServiceRoleClient();

  for (let attempt = 0; attempt < 6; attempt++) {
    const tokenPlain = generateReservationConfirmationRaw();
    const tokenDisplay = formatReservationConfirmationDisplay(tokenPlain);
    const tokenHash = hashReservationTokenPlain(tokenPlain);
    const publicRef = generateReservationPublicRef();

    const { data, error } = await supabase.rpc("create_public_reservation", {
      p_event_day_id: eventDayId,
      p_selected_morning_slot_id: selectedMorningSlotId,
      p_team_name: team.teamName!.trim(),
      p_strength_category: team.strengthCategory,
      p_contact_name: team.contactName!.trim(),
      p_contact_email: team.contactEmail!.trim(),
      p_contact_phone: phoneDigits,
      p_participant_count: participantCount,
      p_lunch_items: lunchItemsToRpcJson(lunchItems),
      p_remarks: "",
      p_token_hash: tokenHash,
      p_representative_grade_year: gradeYear,
      p_public_ref: publicRef,
    });

    if (error) {
      logPublicReserveApiSupabaseError("POST /api/reservations create_public_reservation", error);
      return NextResponse.json({ error: PUBLIC_RESERVE_API_WRITE_ERROR_JA }, { status: 500 });
    }

    const result = data as RpcResult | null;
    if (!result || typeof result !== "object") {
      return NextResponse.json({ error: "予約の処理に失敗しました" }, { status: 500 });
    }

    if (result.success === true && result.reservationId) {
      // 残数・件数が変わったので公開表示（一覧・空き）のキャッシュを無効化
      revalidatePublicReserveCaches();

      const { data: eventDayRow } = await supabase
        .from("event_days")
        .select("event_date, grade_band")
        .eq("id", eventDayId)
        .maybeSingle();

      await sendReservationCreatedEmailAndUpdateNotification({
        supabase,
        reservationId: result.reservationId,
        to: team.contactEmail!.trim(),
        contactName: team.contactName!.trim(),
        teamName: team.teamName!.trim(),
        eventDateIso: eventDayRow?.event_date ?? null,
        gradeBand: eventDayRow?.grade_band ?? null,
        representativeGradeYear: gradeYear,
        reservationTokenPlain: tokenPlain,
        reservationTokenDisplay: tokenDisplay,
        publicRef,
      });

      return NextResponse.json(
        {
          reservationToken: tokenPlain,
          reservationTokenDisplay: tokenDisplay,
          publicRef,
        },
        { status: 201 }
      );
    }

    const err = result.error ?? "unknown";
    if (err === "token_collision") {
      continue;
    }

    const { status, body } = mapRpcError(err);
    if (err === "invalid_input" && typeof result.message === "string" && result.message.trim()) {
      /** RPC は短い内部タグのみ返すが、公開レスポンスには載せずログで追跡する */
      console.error("[public-reserve-api] POST /api/reservations create_public_reservation invalid_input", {
        rpcMessageTag: result.message.trim(),
      });
    }
    return NextResponse.json(body, { status });
  }

  return NextResponse.json(
    { error: "確認コードの生成が続けて競合しました。しばらくしてから再度お試しください" },
    { status: 503 }
  );
}
