"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  };
  return <button className="btn btn-ghost" onClick={signOut}>로그아웃</button>;
}
