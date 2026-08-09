import { createClient } from "@/lib/supabase/server";
import { getCommentedPosts, getReadPostIds } from "@/lib/queries";
import MyPostsClient from "@/components/MyPostsClient";
import LogoutButton from "@/components/LogoutButton";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("name, initial").eq("id", user!.id).single();

  // 내가 독후감 남긴 글
  const { data: myReviews } = await sb.from("reviews").select("post_id").eq("author_id", user!.id).eq("is_draft", false);
  const postIds = [...new Set((myReviews ?? []).map((r: { post_id: string }) => r.post_id))];
  let insights: Post[] = [];
  if (postIds.length) {
    const { data } = await sb.from("posts").select("*, company:companies(*), author:profiles(name, initial)").in("id", postIds);
    insights = (data as unknown as Post[]) ?? [];
  }

  const [comments, readIds] = await Promise.all([
    getCommentedPosts(user!.id),
    getReadPostIds(user!.id),
  ]);

  const mark = (p: Post) => ({ ...p, read: readIds.has(p.id) });

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
        </div>
        <MyPostsClient insights={insights.map(mark)} comments={comments.map(mark)} />
        <div style={{ marginTop: 20 }}><LogoutButton /></div>
      </div>
    </>
  );
}
