import { LunchMenuAdminClient } from "./lunch-menu-admin-client";

/** 管理: 昼食メニュー（税込・表示 ON/OFF・並び順） */
export default function AdminLunchMenuPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">昼食メニュー</h1>
        <p className="mt-2 text-sm text-zinc-600">
          予約画面に表示する昼食の一覧です。一度予約に入ったメニュー名・金額は、その予約の記録として残り、ここでメニューを直しても、すでに付いた予約の表示は自動では変わりません。
        </p>
      </div>
      <LunchMenuAdminClient />
    </div>
  );
}
