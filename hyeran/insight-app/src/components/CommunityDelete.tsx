"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

export default function CommunityDelete({ id }: { id: string }) {
  const router = useRouter();
  const del = async () => {
    if (!confirm("이 자유글을 삭제할까요?")) return;
    await createClient().from("community_posts").delete().eq("id", id);
    router.replace("/insight");
  };
  return <button className="iconbtn" onClick={del} aria-label="삭제"><Icon name="trash" /></button>;
}
