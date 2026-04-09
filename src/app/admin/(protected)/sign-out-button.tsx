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
      className="text-zinc-600 underline hover:text-zinc-900"
    >
      ログアウト
    </button>
  );
}
