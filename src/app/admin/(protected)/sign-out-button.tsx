"use client";

/** 保護レイアウト用。Supabase signOut 後に /admin/login へ。 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineSpinner } from "@/components/ui/inline-spinner";
import { createClient } from "@/lib/supabase/client";

export function AdminSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void signOut()}
      className="inline-flex min-h-9 min-w-[4.5rem] shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? <InlineSpinner variant="onLight" /> : null}
      {pending ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
