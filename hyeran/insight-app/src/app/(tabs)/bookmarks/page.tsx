import { createClient } from "@/lib/supabase/server";
import { getBookmarkedPosts, getReadPostIds } from "@/lib/queries";
import PostRow from "@/components/PostRow";

export const dynamic = "force-dynamic";

// 북마크 — 나중에 읽을 글을 모아두는 곳. 탭 4개 중 하나
export default async function BookmarksPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [posts, readIds] = await Promise.all([
    getBookmarkedPosts(user!.id),
    getReadPostIds(user!.id),
  ]);

  return (
    <>
      <div className="appbar"><span className="title">북마크</span></div>
      <div className="pad">
        {posts.length ? (
          <>
            <div className="stat-note">{posts.length}건</div>
            <div className="feed-list">
              {posts.map((p) => (
                <PostRow key={p.id} post={{ ...p, read: readIds.has(p.id), bookmarked: true }} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <div className="art" />
            <div className="msg">저장한 글이 없어요<br />카드의 북마크를 눌러 모아두세요</div>
          </div>
        )}
      </div>
    </>
  );
}
