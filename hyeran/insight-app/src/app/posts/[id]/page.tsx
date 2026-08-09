import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReviewsForPost } from "@/lib/queries";
import { CAT_COLOR, type Post } from "@/lib/types";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import BackButton from "@/components/BackButton";
import BookmarkButton from "@/components/BookmarkButton";
import ReviewSheet from "./review-sheet";
import CommentSheet from "@/components/CommentSheet";

export const dynamic = "force-dynamic";

const RQ = ["인상 깊은 부분", "업무 적용", "인사이터에게 질문"] as const;

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  // 병렬 조회 (상세 열람 속도)
  const [postRes, reviews, bmRes, mineRes] = await Promise.all([
    sb.from("posts").select("*, company:companies(*)").eq("id", id).single(),
    getReviewsForPost(id),
    sb.from("bookmarks").select("post_id").eq("user_id", user!.id).eq("post_id", id).maybeSingle(),
    sb.from("reviews").select("q1, q2, q3").eq("post_id", id).eq("author_id", user!.id).maybeSingle(),
  ]);
  const post = postRes.data as Post | null;
  if (!post) notFound();
  const bm = bmRes.data;
  const mine = mineRes.data;
  const initial: [string, string, string] = [mine?.q1 ?? "", mine?.q2 ?? "", mine?.q3 ?? ""];

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="appbar">
        <BackButton />
        <span className="spacer" />
        <BookmarkButton postId={post.id} initial={!!bm} />
      </div>
      <div className="pad">
        <div style={{ height: 3, width: 28, background: CAT_COLOR[post.category], borderRadius: 2, marginBottom: 12 }} />
        <h1 className="d-title">{post.title}</h1>
        <div className="comprow" style={{ marginTop: 0 }}>
          <CompanyLogo company={post.company} />
          <span className="cname">{post.company?.name}</span>
          <span className="meta mono" style={{ marginLeft: 8 }}>
            {new Date(post.published_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </span>
        </div>
        {post.tags.length > 0 && (
          <div className="tagrow">{post.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
        )}

        <div className="ai-card">
          <div className="lab"><Icon name="sparkle" size="sm" /> AI 요약</div>
          <div className="ai-q"><div className="q">무슨 문제를 다뤘나</div><div className="a">{post.ai_summary.problem}</div></div>
          <div className="ai-q"><div className="q">어떻게 해결했나</div><div className="a">{post.ai_summary.solution}</div></div>
          <div className="ai-q"><div className="q">기획 관점에서 무엇을 배울 수 있나</div><div className="a">{post.ai_summary.learning}</div></div>
        </div>

        {post.parsed && post.body.length > 0 ? (
          <>
            <div className="sec-title">원문</div>
            <div className="article">{post.body.map((s, i) => <p key={i}>{s}</p>)}</div>
          </>
        ) : (
          <a className="linkcard" href={post.url ?? "#"} target="_blank" rel="noreferrer">
            <Icon name="ext" size="sm" />
            <div className="txt">원문은 이 링크에서 확인하세요<br />{post.url}</div>
          </a>
        )}

        <div className="sec-title">독후감 {reviews.length}</div>
        <ReviewSheet postId={post.id} initial={initial} />
        {reviews.length ? (
          reviews.map((r) => (
            <div key={r.id} className="review">
              <div className="who">
                <span className="avatar">{r.author?.initial ?? "?"}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.author?.name ?? "인사이터"}</span>
                <span className="meta mono" style={{ marginLeft: "auto" }}>
                  {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                </span>
              </div>
              {[r.q1, r.q2, r.q3].map((a, i) => (
                <div className="rq" key={i}>
                  <div className="q">{RQ[i]}</div>
                  {a?.trim()
                    ? <div className="a">{a}</div>
                    : <div className="a" style={{ color: "var(--text-sub)", opacity: 0.6 }}>미작성</div>}
                </div>
              ))}
              <CommentSheet
                reviewId={r.id}
                reviewAuthorId={r.author_id}
                count={r.comment_count ?? 0}
                preview={{ name: r.author?.name ?? "인사이터", initial: r.author?.initial ?? "?", text: [r.q1, r.q2, r.q3].find((x) => x?.trim()) ?? "" }}
              />
            </div>
          ))
        ) : (
          <div className="empty"><div className="art" /><div className="msg">첫 번째 독후감을 남겨보세요</div></div>
        )}
      </div>
    </div>
  );
}
