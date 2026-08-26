import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReviewsForPost, getCommentsForReviews } from "@/lib/queries";
import { CAT_COLOR, coverImage, type Post } from "@/lib/types";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import BackButton from "@/components/BackButton";
import BookmarkButton from "@/components/BookmarkButton";
import ShareButton from "@/components/ShareButton";
import ReviewList from "@/components/ReviewList";
import ReviewSheet from "@/components/ReviewSheet";
import PostOwnerMenu from "@/components/PostOwnerMenu";
import ReadTracker from "@/components/ReadTracker";
import ArticleReader from "@/components/ArticleReader";
import DetailTabs from "@/components/DetailTabs";

export const dynamic = "force-dynamic";

export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ insight?: string }> }) {
  const { id } = await params;
  const focusReviewId = (await searchParams).insight ?? null;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const [postRes, reviews, bmRes, mineRes, readRes, hlRes] = await Promise.all([
    sb.from("posts").select("*, company:companies(*), author:profiles!posts_author_id_fkey(name, initial)").eq("id", id).single(),
    getReviewsForPost(id, user!.id),
    sb.from("bookmarks").select("post_id").eq("user_id", user!.id).eq("post_id", id).maybeSingle(),
    sb.from("reviews").select("q1, q2, q3").eq("post_id", id).eq("author_id", user!.id).maybeSingle(),
    sb.from("reads").select("post_id").eq("user_id", user!.id).eq("post_id", id).maybeSingle(),
    sb.from("highlights").select("sentence_idx, memo").eq("user_id", user!.id).eq("post_id", id),
  ]);
  const post = postRes.data as unknown as Post | null;
  if (!post) notFound();
  const bm = bmRes.data;
  const mine = mineRes.data;
  const initial: [string, string, string] = [mine?.q1 ?? "", mine?.q2 ?? "", mine?.q3 ?? ""];
  const isOwner = post.source === "direct" && post.author_id === user!.id;
  const highlights = (hlRes.data ?? []) as { sentence_idx: number; memo: string | null }[];
  const comments = await getCommentsForReviews(reviews.map((r) => r.id), user!.id);
  const cover = coverImage(post);

  // 원문 탭
  const original = (
    <>
      <div className="ai-card">
        <div className="lab"><Icon name="sparkle" size="sm" /> AI 요약</div>
        <div className="ai-q"><div className="q">무슨 문제를 다뤘나</div><div className="a">{post.ai_summary.problem}</div></div>
        <div className="ai-q"><div className="q">어떻게 해결했나</div><div className="a">{post.ai_summary.solution}</div></div>
        <div className="ai-q"><div className="q">기획 관점에서 무엇을 배울 수 있나</div><div className="a">{post.ai_summary.learning}</div></div>
      </div>

      {post.parsed && post.body.length > 0 ? (
        <>
          <div className="sec-head">
            <span className="sec-title">원문</span>
            {post.url && (
              <a className="src-link" href={post.url} target="_blank" rel="noreferrer"><Icon name="ext" size="sm" />원문 링크</a>
            )}
          </div>
          <ArticleReader postId={post.id} body={post.body} initial={highlights} />
        </>
      ) : (
        <a className="linkcard" href={post.url ?? "#"} target="_blank" rel="noreferrer">
          <Icon name="ext" size="sm" />
          <div className="txt">원문은 이 링크에서 확인하세요<br />{post.url}</div>
        </a>
      )}
    </>
  );

  // 인사이트 탭
  const insights = (
    <>
      <div id="insights" className="ins-anchor" />
      <ReviewList postId={post.id} reviews={reviews} comments={comments} userId={user!.id} myInitial={initial} focusReviewId={focusReviewId} />
    </>
  );

  return (
    <div style={{ paddingBottom: 96 }}>
      <div className="appbar">
        <BackButton />
        <span className="spacer" />
        {isOwner && (
          <PostOwnerMenu postId={post.id} reviewCount={reviews.length} commentCount={reviews.reduce((s, r) => s + (r.comment_count ?? 0), 0)} />
        )}
        <ShareButton title={post.title} />
        <BookmarkButton postId={post.id} initial={!!bm} />
      </div>
      <ReadTracker postId={post.id} alreadyRead={!!readRes.data} />

      {cover && <div className="d-thumb" style={{ backgroundImage: `url("${cover}")` }} />}

      <div className="pad">
        <div style={{ height: 3, width: 28, background: CAT_COLOR[post.category], borderRadius: 2, margin: "14px 0 12px" }} />
        <h1 className="d-title">{post.title}</h1>
        {post.tags.length > 0 && (
          <div className="tagrow">{post.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
        )}
        <div className="comprow" style={{ marginTop: 10 }}>
          <CompanyLogo company={post.company} />
          <span className="cname">{post.company?.name ?? (post.source === "direct" ? post.author?.name : "")}</span>
          <span className="meta mono" style={{ marginLeft: 8 }}>
            {new Date(post.published_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </span>
        </div>

        {post.source === "direct" && (
          <div className="author-card">
            <span className="avatar">{post.author?.initial ?? "?"}</span>
            <div>
              <div className="nm">{post.author?.name ?? "인사이터"}</div>
              <div className="rl">직접 등록한 글</div>
            </div>
            <span className="tag-direct">직접 등록</span>
          </div>
        )}

        <DetailTabs original={original} insights={insights} insightCount={reviews.length} defaultTab={focusReviewId ? "insight" : "original"} />
      </div>

      {/* 상시 플로팅 CTA */}
      <ReviewSheet
        postId={post.id}
        initial={initial}
        trigger={<button className="fab-cta">{mine ? "내 인사이트 수정" : "내 생각도 남겨볼까요?"}</button>}
      />
    </div>
  );
}
