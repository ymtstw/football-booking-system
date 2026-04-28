"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RESERVE_PARTICIPANT_COUNT_HINT_JA } from "@/lib/copy/reserve-participant-lunch-hints";
import {
  LUNCH_MENU_QTY_MAX_DIGITS,
  parseLunchQuantityField,
} from "@/lib/lunch/parse-lunch-qty-field";
import type {
  LunchMenuItemPublic,
  ReservationLunchLinePublic,
} from "@/lib/lunch/types";
import { formatJpyInteger } from "@/lib/money/format-tax-included-jpy";
import { gradeYearLabelJa } from "@/lib/reservations/grade-year";
import {
  exceedsReserveCountMaxAllowed,
  RESERVE_COUNT_MAX_ALLOWED,
} from "@/lib/reservations/reserve-numeric-sanity";
import { RESERVE_STRENGTH_OPTIONS } from "@/lib/reservations/strength-labels";
import { inputAsciiDigitsOnly } from "@/lib/validators/digits-input";

function lunchQtyStringsFromLines(
  menus: LunchMenuItemPublic[],
  lines: ReservationLunchLinePublic[]
): Record<string, string> {
  const byMenu = new Map<string, number>();
  for (const line of lines) {
    if (line.menuItemId) {
      byMenu.set(line.menuItemId, line.quantity);
    }
  }
  const out: Record<string, string> = {};
  for (const m of menus) {
    const q = byMenu.get(m.id);
    out[m.id] = q !== undefined && q > 0 ? String(q) : "";
  }
  return out;
}

type Strength = "strong" | "potential";

type Props = {
  reservationId: string;
  /** URL の `?edit=1` などで開いたとき true */
  initialEditOpen?: boolean;
  /** nested: 親の見出し・枠があるとき（モバイルアコーディオン内など） */
  chrome?: "standalone" | "nested";
  /** 開催日の昼食メニュー（編集フォームで数量を変更する） */
  lunchMenuItems?: LunchMenuItemPublic[];
  /** 現在の昼食明細（初期数量に使用） */
  initialLunchLines?: ReservationLunchLinePublic[];
  initial: {
    participant_count: number;
    remarks: string;
    team_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    strength_category: Strength;
    representative_grade_year: number | null;
  };
};

export function ReservationDetailEditClient({
  reservationId,
  initialEditOpen = false,
  chrome = "standalone",
  lunchMenuItems = [],
  initialLunchLines = [],
  initial,
}: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(initialEditOpen);

  const [participantCount, setParticipantCount] = useState(
    String(initial.participant_count)
  );
  const [remarks, setRemarks] = useState(initial.remarks);
  const [teamName, setTeamName] = useState(initial.team_name);
  const [contactName, setContactName] = useState(initial.contact_name);
  const [contactEmail, setContactEmail] = useState(initial.contact_email);
  const [contactPhone, setContactPhone] = useState(initial.contact_phone);
  const [strength, setStrength] = useState<Strength>(initial.strength_category);
  const [gradeYear, setGradeYear] = useState(
    initial.representative_grade_year == null
      ? ""
      : String(initial.representative_grade_year)
  );
  const [copyEmailState, setCopyEmailState] = useState<"idle" | "ok" | "err">(
    "idle"
  );
  const [copyPhoneState, setCopyPhoneState] = useState<"idle" | "ok" | "err">(
    "idle"
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lunchQtyByMenuId, setLunchQtyByMenuId] = useState<
    Record<string, string>
  >(() => lunchQtyStringsFromLines(lunchMenuItems, initialLunchLines));

  /** サーバー更新後に親から initial が変わったとき同期 */
  useEffect(() => {
    setParticipantCount(String(initial.participant_count));
    setRemarks(initial.remarks);
    setTeamName(initial.team_name);
    setContactName(initial.contact_name);
    setContactEmail(initial.contact_email);
    setContactPhone(initial.contact_phone);
    setStrength(initial.strength_category);
    setGradeYear(
      initial.representative_grade_year == null
        ? ""
        : String(initial.representative_grade_year)
    );
  }, [
    initial.participant_count,
    initial.remarks,
    initial.team_name,
    initial.contact_name,
    initial.contact_email,
    initial.contact_phone,
    initial.strength_category,
    initial.representative_grade_year,
  ]);

  useEffect(() => {
    setLunchQtyByMenuId(lunchQtyStringsFromLines(lunchMenuItems, initialLunchLines));
  }, [lunchMenuItems, initialLunchLines]);

  /** `?edit=1` で遷移するとき同一ルートのため editMode が再初期化されない */
  useEffect(() => {
    if (initialEditOpen) {
      setEditMode(true);
    }
  }, [initialEditOpen]);

  async function copyText(
    text: string,
    setState: (v: "idle" | "ok" | "err") => void
  ) {
    setState("idle");
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("err");
    }
  }

  function cancelEditing() {
    setEditMode(false);
    setMessage(null);
    setError(null);
    setParticipantCount(String(initial.participant_count));
    setRemarks(initial.remarks);
    setTeamName(initial.team_name);
    setContactName(initial.contact_name);
    setContactEmail(initial.contact_email);
    setContactPhone(initial.contact_phone);
    setStrength(initial.strength_category);
    setGradeYear(
      initial.representative_grade_year == null
        ? ""
        : String(initial.representative_grade_year)
    );
    setLunchQtyByMenuId(lunchQtyStringsFromLines(lunchMenuItems, initialLunchLines));
  }

  async function save() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const gyTrim = gradeYear.trim();
      if (gyTrim === "") {
        setError("代表学年を入力してください（1〜6）");
        return;
      }
      const gy = Number(gyTrim);
      if (!Number.isInteger(gy) || gy < 1 || gy > 6) {
        setError("代表学年は 1〜6 の整数で入力してください");
        return;
      }
      const representative_grade_year = gy;
      const pc = Number(participantCount.trim());
      if (!Number.isInteger(pc) || pc < 1) {
        setError("参加人数は 1 以上の整数にしてください");
        return;
      }
      if (exceedsReserveCountMaxAllowed(pc)) {
        setError(
          `参加人数は ${RESERVE_COUNT_MAX_ALLOWED} 以下の整数にしてください`
        );
        return;
      }

      const payload: Record<string, unknown> = {
        participant_count: pc,
        remarks,
        team: {
          team_name: teamName.trim(),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim(),
          strength_category: strength,
          representative_grade_year,
        },
      };

      if (lunchMenuItems.length > 0) {
        const lunchItems: { menuItemId: string; quantity: number }[] = [];
        for (const m of lunchMenuItems) {
          const parsed = parseLunchQuantityField(lunchQtyByMenuId[m.id]);
          if (!parsed.ok) {
            setError(
              `昼食「${m.name}」の数量が不正です。0〜500 の半角数字で入力してください。`
            );
            return;
          }
          lunchItems.push({ menuItemId: m.id, quantity: parsed.quantity });
        }
        const lunchSum = lunchItems.reduce((s, x) => s + x.quantity, 0);
        if (lunchSum === 0) {
          setError("昼食の食数を1以上にしてください");
          return;
        }
        if (exceedsReserveCountMaxAllowed(lunchSum)) {
          setError(
            `昼食の食数の合計は ${RESERVE_COUNT_MAX_ALLOWED} 以下にしてください`
          );
          return;
        }
        payload.lunchItems = lunchItems;
      }

      const res = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "保存に失敗しました");
        return;
      }
      setMessage("保存しました");
      setEditMode(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const representativeView =
    gradeYear.trim() === ""
      ? "—"
      : /^[1-6]$/.test(gradeYear.trim())
        ? gradeYearLabelJa(Number(gradeYear.trim()))
        : gradeYear.trim();

  const inner = (
    <>
      {!editMode ? (
        <>
          <dl
            className={`space-y-3 text-sm ${chrome === "standalone" ? "mt-4" : "mt-0"}`}
          >
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">チーム名</dt>
              <dd className="wrap-break-word font-medium text-zinc-900">
                {teamName}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">申込者名</dt>
              <dd className="wrap-break-word">{contactName}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-start">
              <dt className="text-zinc-500">メールアドレス</dt>
              <dd className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 wrap-break-word">
                    {contactEmail}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(contactEmail, (v) => setCopyEmailState(v))
                    }
                    disabled={!contactEmail.trim()}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    コピー
                  </button>
                </div>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr] sm:items-start">
              <dt className="text-zinc-500">電話番号</dt>
              <dd className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 wrap-break-word font-mono text-sm">
                    {contactPhone}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(contactPhone, (v) => setCopyPhoneState(v))
                    }
                    disabled={!contactPhone.trim()}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    コピー
                  </button>
                </div>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">カテゴリ</dt>
              <dd>
                {RESERVE_STRENGTH_OPTIONS.find((o) => o.value === strength)
                  ?.label ?? strength}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">代表学年</dt>
              <dd>{representativeView}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">人数</dt>
              <dd className="tabular-nums">{participantCount}名</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr]">
              <dt className="text-zinc-500">備考</dt>
              <dd className="whitespace-pre-wrap wrap-break-word">
                {remarks.trim() === "" ? "—" : remarks}
              </dd>
            </div>
          </dl>

          {copyEmailState === "ok" || copyPhoneState === "ok" ? (
            <p className="mt-2 text-xs text-emerald-800">コピーしました</p>
          ) : copyEmailState === "err" || copyPhoneState === "err" ? (
            <p className="mt-2 text-xs text-red-700">コピーに失敗しました</p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              setMessage(null);
              setError(null);
            }}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
          >
            編集フォームを開く
          </button>
        </>
      ) : (
        <>
          <div className="mb-2 flex min-h-8 justify-end">
            <button
              type="button"
              onClick={() => cancelEditing()}
              disabled={saving}
              className="inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-zinc-600 underline decoration-zinc-400/60 underline-offset-2 hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50"
            >
              閉じる
            </button>
          </div>
          <p
            className={`text-xs text-zinc-600 ${chrome === "standalone" ? "mt-2" : "mt-0"}`}
          >
            試合時間や対戦の割当は変更できません。「試合表を調整」から行ってください。
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">チーム名</span>
              <input
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={teamName}
                maxLength={120}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">代表者名（申込者名）</span>
              <input
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={contactName}
                maxLength={80}
                onChange={(e) => setContactName(e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">メールアドレス</span>
              <input
                type="email"
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={contactEmail}
                maxLength={254}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">電話番号</span>
              <input
                type="tel"
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={contactPhone}
                maxLength={40}
                onChange={(e) => setContactPhone(e.target.value)}
                disabled={saving}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">カテゴリ</span>
              <select
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={strength}
                onChange={(e) => setStrength(e.target.value as Strength)}
                disabled={saving}
              >
                {RESERVE_STRENGTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">
                代表学年（1〜6・必須）
              </span>
              <input
                inputMode="numeric"
                required
                maxLength={1}
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={gradeYear}
                onChange={(e) =>
                  setGradeYear(inputAsciiDigitsOnly(e.target.value).slice(0, 1))
                }
                disabled={saving}
                placeholder="例: 4"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">参加人数</span>
              <input
                inputMode="numeric"
                maxLength={4}
                className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                value={participantCount}
                onChange={(e) =>
                  setParticipantCount(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                disabled={saving}
              />
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                {RESERVE_PARTICIPANT_COUNT_HINT_JA}
              </span>
            </label>
            {lunchMenuItems.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/50 p-4 sm:col-span-2">
                <div>
                  <span className="text-sm font-medium text-zinc-900">
                    昼食の数量
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  {lunchMenuItems.map((m) => (
                    <label
                      key={m.id}
                      className="block min-w-0 flex-[1_1_14rem] text-sm"
                    >
                      <span className="font-medium leading-snug text-zinc-800 wrap-break-word">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        税込 {formatJpyInteger(m.priceTaxIncluded)}
                      </span>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          inputMode="numeric"
                          maxLength={LUNCH_MENU_QTY_MAX_DIGITS}
                          className="min-h-10 w-full max-w-28 rounded border border-zinc-300 px-3 py-2 text-sm tabular-nums sm:max-w-36"
                          value={lunchQtyByMenuId[m.id] ?? ""}
                          onChange={(e) => {
                            const v = inputAsciiDigitsOnly(e.target.value).slice(
                              0,
                              LUNCH_MENU_QTY_MAX_DIGITS
                            );
                            setLunchQtyByMenuId((prev) => ({
                              ...prev,
                              [m.id]: v,
                            }));
                          }}
                          disabled={saving}
                          placeholder="0"
                          aria-label={`${m.name} の昼食数`}
                        />
                        <span className="text-sm text-zinc-600">食</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800">備考</span>
              <textarea
                rows={4}
                maxLength={2000}
                className="mt-1 w-full resize-y rounded border border-zinc-300 px-3 py-2 text-sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={saving}
              />
            </label>
          </div>

          {error ? (
            <div
              className="relative mt-4 overflow-hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm"
              role="alert"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 bg-red-500"
                aria-hidden
              />
              <div className="pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
                  保存できませんでした
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-900">
                  {error}
                </p>
              </div>
            </div>
          ) : null}
          {message ? (
            <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
            >
              {saving ? "保存中…" : "予約チーム情報を保存"}
            </button>
            <button
              type="button"
              onClick={() => cancelEditing()}
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              変更を取り消す
            </button>
          </div>
        </>
      )}
    </>
  );

  if (chrome === "nested") {
    return <div className="min-w-0">{inner}</div>;
  }

  return (
    <section
      id="team-contact"
      className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="text-sm font-semibold text-zinc-900">予約チーム情報</h2>
      {inner}
    </section>
  );
}
