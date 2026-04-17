import { LunchMenuAdminClient } from "./lunch-menu-admin-client";

/** 管理: 昼食メニュー（税込・表示 ON/OFF・並び順） */
export default function AdminLunchMenuPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">昼食メニュー</h1>
        <p className="mt-2 text-sm text-zinc-600">
          予約画面に出る昼食のマスタです。予約済みの金額は明細のスナップショットで固定されます。
        </p>
      </div>
      <LunchMenuAdminClient />
    </div>
  );
}
