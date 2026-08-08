import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, initial")
    .eq("id", user.id)
    .single();

  return (
    <div className="stub">
      <h1>로그인 성공 🎉</h1>
      <p>
        {profile?.name ?? user.email} 님, 환영해요.
        <br />
        이제 이 위에 홈·피드·인사이트 화면을 붙여나갑니다.
      </p>
      <LogoutButton />
    </div>
  );
}
