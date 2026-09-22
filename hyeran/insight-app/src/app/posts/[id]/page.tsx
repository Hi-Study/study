import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReviewsForPost, getCommentsForReviews, getRelatedByProblem } from "@/lib/queries";
import { articleOutline, type Post } from "@/lib/types";
import Icon from "@/components/Icon";
import BackButton from "@/components/BackButton";
import BookmarkButton from "@/components/BookmarkButton";
import ShareButton from "@/components/ShareButton";
import ReviewList from "@/components/ReviewList";
import ReviewSheet from "@/components/ReviewSheet";
import PostOwnerMenu from "@/components/PostOwnerMenu";
import ReadTracker from "@/components/ReadTracker";

export const dynamic = "force-dynamic";

// 상세는 "읽기 전 온보딩"이다 [분류체계 §6-2]
// 원문은 앱 안에서 읽지 않고 링크로만 보낸다.
export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ insight?: string }> }) {
  const { id } = await params;
  const focusReviewId = (await searchParams).insight ?? null;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const [postRes, reviews, bmRes, mineRes, readRes] = await Promise.all([
    sb.from("posts").select("*, company:companies(*), author:profiles!posts_author_id_fkey(name, initial)").eq("id", id).single(),
    getReviewsForPost(id, user!.id),
    sb.from("bookmarks").select("post_id").eq("user_id", user!.id).eq("post_id", id).maybeSingle(),
    sb.from("reviews").select("q1, q2, q3").eq("post_id", id).eq("author_id", user!.id).maybeSingle(),
    sb.from("reads").select("post_id").eq("user_id", user!.id).eq("post_id", id).maybeSingle(),
  ]);
  const post = postRes.data as unknown as Post | null;
  if (!post) notFound();

  const [comments, related] = await Promise.all([
    getCommentsForReviews(reviews.map((r) => r.id), user!.id),
    getRelatedByProblem(post.id, post.problem_type),
  ]);

  const mine = mineRes.data;
  const initial: [string, string, string] = [mine?.q1 ?? "", mine?.q2 ?? "", mine?.q3 ?? ""];
  const isOwner = post.source === "direct" && post.author_id === user!.id;
  const who = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  const outline = articleOutline(post.body);
  const s = post.ai_summary ?? {};
  const hasSummary = !!(s.problem || s.decision || s.implementation || s.impact || s.solution);

  return (
    <div style={{ paddingBottom: 96 }}>
      <div className="appbar">
        <BackButton />
        <span className="spacer" />
        {isOwner && (
          <PostOwnerMenu postId={post.id} reviewCount={reviews.length} commentCount={reviews.reduce((a, r) => a + (r.comment_count ?? 0), 0)} />
        )}
        <BookmarkButton postId={post.id} initial={!!bmRes.data} />
        <ShareButton title={post.title} />
      </div>
      <ReadTracker postId={post.id} alreadyRead={!!readRes.data} />

      <div className="pad">
        {/* 출처 · 발행일 */}
        <div className="d-src">
          {post.company?.slug ? (
            <Link href={`/companies/${post.company.slug}`}>{who}</Link>
          ) : <span>{who}</span>}
          <span className="dot">·</span>
          <span>{new Date(post.published_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
        </div>

        {/* 원제목을 크게 — 출처 신뢰가 걸려 있어 헤드라인으로 대체하지 않는다 */}
        <h1 className="d-title">{post.title}</h1>

        {/* 좌표 칩 — problem_type 이 null 이면 그 칩만 빠진다 */}
        {(post.article_kind || post.problem_type || post.impact_targets?.length > 0) && (
          <div className="coord">
            {post.article_kind && <span className="coord-chip">{post.article_kind}</span>}
            {post.problem_type && <span className="coord-chip on">{post.problem_type}</span>}
            {post.impact_targets?.length > 0 && (
              <span className="coord-chip">{post.impact_targets.map((t) => t.split(" ")[0]).join(" · ")}</span>
            )}
          </div>
        )}

        {/* 읽기 전에 — null 인 문항은 블록째 렌더링하지 않는다 [§3] */}
        {hasSummary && (
          <section className="dsec">
            <h2 className="dsec-title">읽기 전에</h2>
            <div className="ai-card">
              {s.problem && <div className="ai-q"><div className="q">어떤 문제를 다루고 있나요</div><div className="a">{s.problem}</div></div>}
              {s.decision && <div className="ai-q"><div className="q">어떤 의사결정을 했나요</div><div className="a">{s.decision}</div></div>}
              {s.implementation && <div className="ai-q"><div className="q">어떻게 구현했나요</div><div className="a">{s.implementation}</div></div>}
              {/* 재판정 전 글은 아직 v3.2 구조(solution)를 갖고 있다 */}
              {!s.decision && !s.implementation && s.solution && (
                <div className="ai-q"><div className="q">어떻게 풀었나요</div><div className="a">{s.solution}</div></div>
              )}
              {s.impact && <div className="ai-q"><div className="q">무엇이 달라졌나요</div><div className="a">{s.impact}</div></div>}
            </div>
          </section>
        )}

        {/* 알아두면 좋을 말 — 비었으면 섹션 숨김 */}
        {post.terms?.length > 0 && (
          <section className="dsec">
            <h2 className="dsec-title">알아두면 좋을 말</h2>
            {post.terms.map((t) => (
              <div className="term-row" key={t.term}>
                <span className="term-name">{t.term}</span>
                <span className="term-desc">{t.description}</span>
              </div>
            ))}
          </section>
        )}

        {/* 원문은 이렇게 흘러가요 — 원문 헤딩으로 만든 목차. 헤딩이 2개 미만이면 숨김 */}
        {outline.items.length > 0 && (
          <section className="dsec">
            <h2 className="dsec-title">원문은 이렇게 흘러가요</h2>
            <div className="outline-head">전체 {outline.totalMinutes}분 · 필요한 데부터 읽어도 괜찮아요</div>
            <ol className="outline">
              {outline.items.map((it, i) => (
                <li key={i}>
                  <span className="ol-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ol-t">{it.title}</span>
                  <span className="ol-m">{it.minutes}분</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 원문 읽으러 가기 */}
        {post.url && (
          <a className="read-cta" href={post.url} target="_blank" rel="noreferrer">
            원문 읽으러 가기 <Icon name="ext" size="sm" />
          </a>
        )}

        {/* 같은 문제를 다룬 사례 */}
        {related.length > 0 && (
          <section className="dsec">
            <h2 className="dsec-title">같은 문제를 다룬 사례</h2>
            {related.map((r) => (
              <Link key={r.id} className="rel-card" href={`/posts/${r.id}`}>
                <span className="rel-co">{r.company?.name ?? ""}</span>
                <span className="rel-title">{r.title}</span>
                {r.headline && <span className="rel-sub">{r.headline}</span>}
              </Link>
            ))}
          </section>
        )}

        {/* 인사이트 */}
        <section className="dsec">
          <div id="insights" className="ins-anchor" />
          <ReviewList postId={post.id} reviews={reviews} comments={comments} userId={user!.id} myInitial={initial} focusReviewId={focusReviewId} />
        </section>
      </div>

      <ReviewSheet postId={post.id} initial={initial} trigger={<button className="fab-cta">내 생각도 남겨볼까요?</button>} />
    </div>
  );
}
