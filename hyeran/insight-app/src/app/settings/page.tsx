import Link from "next/link";
import Icon from "@/components/Icon";
import SettingsClient from "@/components/SettingsClient";
import { getCurrentProfile } from "@/lib/queries";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="page">
      <div className="top">
        <Link href="/my" className="icon-btn" aria-label="뒤로">
          <Icon name="back" />
        </Link>
        <span className="title">설정</span>
        <span className="spacer-36" />
      </div>
      <div className="content">
        <div className="profile-block">
          <div className="avatar lg">{profile?.initial || "?"}</div>
          <div>
            <div className="profile-name">{profile?.name || "사용자"}</div>
            <div className="profile-sub">기획자 스터디</div>
          </div>
        </div>
        <SettingsClient />
      </div>
    </div>
  );
}
