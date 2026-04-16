"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Strength = "strong" | "potential";

type Props = {
  reservationId: string;
  initial: {
    participant_count: number;
    remarks: string;
    display_name: string;
    team_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    strength_category: Strength;
    representative_grade_year: number | null;
  };
};

export function ReservationDetailEditClient({ reservationId, initial }: Props) {
  const router = useRouter();
  const [participantCount, setParticipantCount] = useState(
    String(initial.participant_count)
  );
  const [remarks, setRemarks] = useState(initial.remarks);
  const [displayName, setDisplayName] = useState(initial.display_name);
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const gyTrim = gradeYear.trim();
      let representative_grade_year: number | null = null;
      if (gyTrim !== "") {
        const gy = Number(gyTrim);
        if (!Number.isInteger(gy) || gy < 1 || gy > 6) {
          setError("代表学年は 1〜6 の整数、または空欄にしてください");
          return;
        }
        representative_grade_year = gy;
      }
      const pc = Number(participantCount.trim());
      if (!Number.isInteger(pc) || pc < 1) {
        setError("参加人数は 1 以上の整数にしてください");
        return;
      }

      const res = await fetch(`/api/admin/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_count: pc,
          remarks,
          display_name: displayName.trim() === "" ? null : displayName.trim(),
          team: {
            team_name: teamName.trim(),
            contact_name: contactName.trim(),
            contact_email: contactEmail.trim(),
            contact_phone: contactPhone.trim(),
            strength_category: strength,
            representative_grade_year,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "保存に失敗しました");
        return;
      }
      setMessage("保存しました");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-900">予約・チーム情報の編集</h2>
      <p className="text-xs leading-relaxed text-zinc-600">
        午前枠の付け替え・試合編成はここでは変更しません。
        <strong className="text-zinc-800"> 前日確定</strong>
        の補正・試合一覧から行ってください。
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">チーム名</span>
          <input
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">代表者名（申込者名）</span>
          <input
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={contactName}
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
            onChange={(e) => setContactPhone(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">強さ区分</span>
          <select
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={strength}
            onChange={(e) => setStrength(e.target.value as Strength)}
            disabled={saving}
          >
            <option value="strong">strong（強）</option>
            <option value="potential">potential（伸びしろ）</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">代表学年（1〜6・空欄可）</span>
          <input
            inputMode="numeric"
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={gradeYear}
            onChange={(e) => setGradeYear(e.target.value)}
            disabled={saving}
            placeholder="例: 4"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">参加人数</span>
          <input
            inputMode="numeric"
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={participantCount}
            onChange={(e) => setParticipantCount(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">表示名（任意）</span>
          <input
            className="mt-1 min-h-10 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
            placeholder="未設定ならチーム名を表示します"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">備考</span>
          <textarea
            rows={4}
            className="mt-1 w-full resize-y rounded border border-zinc-300 px-3 py-2 text-sm"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={saving}
          />
        </label>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
