import { LunchMenuAdminClient } from "./lunch-menu-admin-client";

/** 管理: 昼食メニュー（税込・表示 ON/OFF・並び順） */
export default function AdminLunchMenuPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">昼食メニュー設定</h1>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-600">
          <p>予約画面に表示する昼食メニューを管理します。</p>
          <p>ここで変更した内容は、これからの新規予約に反映されます。</p>
          <p>
            すでに予約済みの昼食内容・金額は、予約時点の内容として残ります。
          </p>
        </div>
      </div>
      <LunchMenuAdminClient />
    </div>
  );
}
