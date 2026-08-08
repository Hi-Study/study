import BackButton from "@/components/BackButton";

export default function NotificationsPage() {
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title">알림</span></div>
      <div className="empty"><div className="art" /><div className="msg">알림은 곧 지원해요</div></div>
    </div>
  );
}
