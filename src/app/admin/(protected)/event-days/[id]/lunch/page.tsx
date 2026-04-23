import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EventDayLunchMenuClient } from "./event-day-lunch-menu-client";
import { getAdminUser } from "@/lib/auth/require-admin";

export default async function AdminEventDayLunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminUser())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  if (!id?.trim()) {
    notFound();
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/event-days/${id}`}
          className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          開催日まとめへ
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">昼食メニュー（この開催日）</h1>
      </div>
      <EventDayLunchMenuClient eventDayId={id} />
    </div>
  );
}
