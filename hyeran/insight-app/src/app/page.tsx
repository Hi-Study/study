import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginButton from "./login-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return (
    <div className="login">
      <div className="wordmark">
        insight<span className="dot">.</span>
      </div>
      <p className="tagline">
        좋은 글을 읽고
        <br />
        나의 인사이트를 나누는 공간
      </p>
      <div className="form">
        <LoginButton />
        <p className="hint">구글 로그인만 지원해요</p>
      </div>
    </div>
  );
}
