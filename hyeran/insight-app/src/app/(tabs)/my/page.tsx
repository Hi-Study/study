import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/PostCard";
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
  let posts: Post[] = [];
  if (postIds.length) {
    const { data } = await sb.from("posts").select("*, company:companies(*)").in("id", postIds);
    posts = (data as Post[]) ?? [];
  }

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
        <div className="seg">
          <a className="on">인사이트 남긴 글</a>
        </div>
        {posts.length ? (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <div className="empty"><div className="art" /><div className="msg">아직 독후감을 남긴 글이 없어요</div></div>
        )}
        <div style={{ marginTop: 20 }}><LogoutButton /></div>
      </div>
    </>
  );
}
