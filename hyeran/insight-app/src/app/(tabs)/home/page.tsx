import Link from "next/link";
import Icon from "@/components/Icon";
import FeedList from "@/components/FeedList";
import { getFeedPosts, getNotifications } from "@/lib/queries";

export default async function HomePage() {
  const [posts, notifications] = await Promise.all([getFeedPosts(), getNotifications()]);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <div className="top">
        <span className="title">어노테이션</span>
        <Link href="/notifications" className="icon-btn" aria-label="알림">
          <Icon name="bell" />
          {unread > 0 && <span className="dot" />}
        </Link>
      </div>
      <FeedList posts={posts} />
      <Link href="/register/step1" className="fab" aria-label="글 등록하기">
        <Icon name="plus" />
      </Link>
    </>
  );
}
