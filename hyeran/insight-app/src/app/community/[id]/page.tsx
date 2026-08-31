import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCommunityPost, getCommentsForTarget } from "@/lib/queries";
import BackButton from "@/components/BackButton";
import LikeButton from "@/components/LikeButton";
import CommentThread from "@/components/CommentThread";
import CommunityDelete from "@/components/CommunityDelete";

export const dynamic = "force-dynamic";

const isVideo = (u: string) => /\.(mp4|webm|mov)$/i.test(u);

export default async function CommunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const post = await getCommunityPost(id, user!.id);
  if (!post) notFound();
  const comments = await getCommentsForTarget("community_post", id, user!.id);
  const isOwner = post.author_id === user!.id;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="appbar">
        <BackButton />
        <span className="spacer" />
        {isOwner && <CommunityDelete id={post.id} />}
      </div>
      <div className="pad">
        <div className="cd-head">
          <span className="avatar">{post.author?.initial ?? "?"}</span>
          <div>
            <div className="nm">{post.author?.name ?? "인사이터"}</div>
            <div className="rl">{new Date(post.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</div>
          </div>
        </div>

        <h1 className="d-title">{post.title}</h1>
        <div className="cd-body">{post.body}</div>

        {post.media.map((u) => (
          isVideo(u)
            ? <video key={u} className="reader-img" src={u} controls />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img key={u} className="reader-img" src={u} alt="" />
        ))}

        <div className="rev-acts" style={{ margin: "16px 0" }}>
          <LikeButton targetType="community_post" targetId={post.id} initialCount={post.like_count ?? 0} initialLiked={post.liked ?? false} />
        </div>

        <CommentThread targetType="community_post" targetId={post.id} ownerId={post.author_id} initial={comments} userId={user!.id} />
      </div>
    </div>
  );
}
