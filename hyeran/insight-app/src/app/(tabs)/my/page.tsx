import Link from "next/link";
import Icon from "@/components/Icon";
import MyClient from "@/components/MyClient";
import { getCurrentProfile, getFeedPosts, getMyDrafts, getMyHighlights } from "@/lib/queries";

export default async function MyPage() {
  const [profile, posts, drafts, highlights] = await Promise.all([
    getCurrentProfile(),
    getFeedPosts(),
    getMyDrafts(),
    getMyHighlights(),
  ]);

  const myPosts = posts.filter((p) => p.sharer_id === profile?.id);
  const bookmarked = posts.filter((p) => p.bookmarked);
  const curated = posts.filter((p) => p.talked);

  return (
    <>
      <div className="top">
        <span className="spacer-36" />
        <span className="title">마이</span>
        <Link href="/settings" className="icon-btn" aria-label="설정">
          <Icon name="settings" />
        </Link>
      </div>
      <MyClient
        profile={profile}
        myPosts={myPosts}
        bookmarked={bookmarked}
        curated={curated}
        highlights={highlights}
        drafts={drafts}
      />
    </>
  );
}
