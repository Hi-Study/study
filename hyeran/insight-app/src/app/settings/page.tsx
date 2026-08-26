import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("name, initial").eq("id", user!.id).single();

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="appbar">
        <BackButton />
        <span className="title">설정</span>
      </div>
      <div className="pad">
        <div className="profile">
          <span className="avatar lg">{profile?.initial ?? "?"}</span>
          <div>
            <div className="nm">{profile?.name ?? "인사이터"}</div>
            <div className="sub">{user?.email}</div>
          </div>
          <LogoutButton />
        </div>

        <div className="set-list">
          <div className="set-sec">계정</div>
          <div className="set-row"><span>이메일</span><span className="set-val">{user?.email}</span></div>
          <div className="set-sec">앱 정보</div>
          <div className="set-row"><span>버전</span><span className="set-val">v3.0</span></div>
        </div>
      </div>
    </div>
  );
}
