import { createClient } from "@/lib/supabase/server";
import { getCommentedPosts, getReadPostIds, getHighlightedPosts, getPostsByIds, getBookmarkedPostIds, getViewedPosts, getMyCommunityPosts, getMyWords, getMyReviewDates } from "@/lib/queries";
import MyPostsClient from "@/components/MyPostsClient";
import MyHeader from "@/components/MyHeader";
import LogoutButton from "@/components/LogoutButton";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("name, initial").eq("id", user!.id).single();

  // 내가 인사이트 남긴 글
  const { data: myReviews } = await sb.from("reviews").select("post_id").eq("author_id", user!.id).eq("is_draft", false);
  const postIds = [...new Set((myReviews ?? []).map((r: { post_id: string }) => r.post_id))];

  const [viewed, insights, comments, highlights, readIds, bmIds, community, words, reviewDates] = await Promise.all([
    getViewedPosts(user!.id),
    getPostsByIds(postIds),
    getCommentedPosts(user!.id),
    getHighlightedPosts(user!.id),
    getReadPostIds(user!.id),
    getBookmarkedPostIds(user!.id),
    getMyCommunityPosts(user!.id),
    getMyWords(user!.id),
    getMyReviewDates(user!.id),
  ]);

  const mark = (p: Post) => ({ ...p, read: readIds.has(p.id), bookmarked: bmIds.has(p.id) });

  return (
    <>
      <div className="appbar"><span className="title">마이</span></div>
      <div className="pad">
        <div className="profile">
          <span className="avatar lg">{profile?.initial ?? "?"}</span>
          <div>
            <div className="nm">{profile?.name ?? "인사이터"}</div>
            <div className="sub">인사이터</div>
          </div>
          <LogoutButton />
        </div>
        <MyHeader insightDates={reviewDates} />
        <MyPostsClient
          viewed={viewed.map(mark)} insights={insights.map(mark)} comments={comments.map(mark)} highlights={highlights.map(mark)}
          community={community} words={words}
        />
      </div>
    </>
  );
}
