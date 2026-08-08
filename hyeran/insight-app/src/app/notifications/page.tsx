import Link from "next/link";
import Icon from "@/components/Icon";
import NotificationsClient from "@/components/NotificationsClient";
import { getNotifications } from "@/lib/queries";

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="page">
      <div className="top">
        <Link href="/home" className="icon-btn" aria-label="뒤로">
          <Icon name="back" />
        </Link>
        <span className="title">알림</span>
        <span className="spacer-36" />
      </div>
      <NotificationsClient notifications={notifications} />
    </div>
  );
}
