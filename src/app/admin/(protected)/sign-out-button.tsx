"use client";

/** 保護レイアウト用。Supabase signOut 後に /admin/login へ。 */
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function AdminSignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="min-h-9 min-w-[4.5rem] shrink-0 rounded-md px-2 py-1.5 text-sm text-zinc-600 underline decoration-zinc-400 underline-offset-2 hover:bg-zinc-100 hover:text-zinc-900"
    >
      ログアウト
    </button>
  );
}
