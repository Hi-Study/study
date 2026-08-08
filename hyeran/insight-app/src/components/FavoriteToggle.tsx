"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

export default function FavoriteToggle({ companyId, initial }: { companyId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      if (next) await sb.from("favorites").insert({ user_id: user.id, company_id: companyId });
      else await sb.from("favorites").delete().eq("user_id", user.id).eq("company_id", companyId);
    }
    setBusy(false);
  };

  return (
    <button className={`startoggle ${on ? "on" : ""}`} onClick={toggle} aria-label="즐겨찾기">
      <Icon name="star" />
    </button>
  );
}
