import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHomeData, getReadPostIds, getBookmarkedPostIds } from "@/lib/queries";
import { FeatureCard } from "@/components/PostCard";
import FeedCard from "@/components/FeedCard";
import Icon from "@/components/Icon";
import type { Post, Review } from "@/lib/types";

export const dynamic = "force-dynamic";

function SecHead({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  return (
    <div className="hsec-head">
      <div>
        <div className="hsec-title">{title}</div>
        {sub && <div className="hsec-sub">{sub}</div>}
      </div>
      {href && <Link href={href} className="see-all">더보기</Link>}
    </div>
  );
}

function firstAnswer(r: Review) { return r.q1?.trim() || r.q2?.trim() || r.q3?.trim() || ""; }

export default async function HomePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [home, readIds, bmIds] = await Promise.all([
    getHomeData(user!.id),
    getReadPostIds(user!.id),
    getBookmarkedPostIds(user!.id),
  ]);
  const mark = (p: Post) => ({ ...p, read: readIds.has(p.id), bookmarked: bmIds.has(p.id) });
  const swipe = (list: Post[]) => <div className="swipe">{list.map((p) => <FeedCard key={p.id} post={mark(p)} />)}</div>;
  const grid = (list: Post[]) => <div className="pop-grid">{list.slice(0, 4).map((p) => <FeedCard key={p.id} post={mark(p)} />)}</div>;

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        <Link href="/search" className="searchbar" style={{ display: "flex" }}>
          <Icon name="search" /><span className="ph">글 제목·기업·태그 검색</span>
        </Link>

        {/* ── 발견 존 ── */}
        {/* ① 오늘의 글 (헤더 없음) */}
        {home.hero && <section className="hsec"><FeatureCard post={mark(home.hero)} /></section>}

        {/* ② 인기 키워드 */}
        {home.keywords.length > 0 && (
          <section className="hsec">
            <SecHead title="요즘 이 단어들이 자주 보여요" />
            <div className="kw-row">
              {home.keywords.map((k) => (
                <Link key={k} href={`/search?q=${encodeURIComponent(k)}`} className="kw-chip">{k}</Link>
              ))}
            </div>
          </section>
        )}

        {/* ③ 인기 글 */}
        {home.popular.length > 0 && (
          <section className="hsec">
            <SecHead
              title={home.popularFallback ? "막 이야기가 시작됐어요" : "요즘 많이 보고 인사이트를 남긴 글"}
              sub={home.popularFallback ? "사람들이 인사이트를 남기고 있어요" : undefined}
            />
            {swipe(home.popular)}
          </section>
        )}

        {/* ④ 인기 인사이트 */}
        {home.popularInsights.length > 0 && (
          <section className="hsec">
            <SecHead
              title={home.popularInsightsFallback ? "먼저 읽은 사람들의 생각은?" : "이 생각에 공감을 많이 했어요"}
              sub={home.popularInsightsFallback ? "다양한 인사이트를 함께 확인해보세요" : undefined}
            />
            <div className="swipe">
              {home.popularInsights.map((r) => (
                <Link key={r.id} href={`/posts/${r.post_id}?insight=${r.id}`} className="ins-mini">
                  <div className="ins-mini-head">
                    <span className="avatar sm">{r.author?.initial ?? "?"}</span>
                    <span className="ins-mini-name">{r.author?.name ?? "인사이터"}</span>
                  </div>
                  <div className="ins-mini-post">{r.post?.title}</div>
                  <div className="ins-mini-body">{firstAnswer(r)}</div>
                  <div className="ins-mini-foot">
                    <span className={r.liked ? "on" : ""}><Icon name="heart" size="sm" />{r.like_count ?? 0}</span>
                    <span><Icon name="comment" size="sm" />{r.comment_count ?? 0}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 나 존 ── */}
        {/* ⑤ 아직 안 끝난 글 */}
        {home.unfinished.length > 0 && (
          <section className="hsec zone">
            <SecHead title="마저 끝내볼까요?" sub="다 읽고 인사이트도 남겨보세요" href="/my" />
            {grid(home.unfinished)}
          </section>
        )}

        {/* ⑥ 추천 글 */}
        {home.recommended.length > 0 && (
          <section className="hsec">
            <SecHead title="이 글도 관심이 있을 것 같아요" />
            {swipe(home.recommended)}
          </section>
        )}

        {/* ── 관심 존 ── */}
        {/* ⑦ 즐겨찾기 기업 새 글 */}
        <section className="hsec zone">
          {home.favEmpty ? (
            <>
              <SecHead title="관심 기업을 골라두세요" />
              <Link href="/feed" className="home-banner">
                <div className="hb-txt"><b>자주 보는 기업을 즐겨찾기 하면</b><br />새 글을 여기서 모아 볼 수 있어요</div>
                <span className="hb-go">기업 고르기 ›</span>
              </Link>
            </>
          ) : home.favNew.length > 0 ? (
            <>
              <SecHead title="관심 기업에 새 글이 올라왔어요" href="/feed" />
              {grid(home.favNew)}
            </>
          ) : null}
        </section>

        {/* ⑧ 사용자 등록 글 */}
        <section className="hsec">
          {home.direct.length > 0 ? (
            <>
              <SecHead title="인사이터가 직접 소개하는 글이에요" href="/feed?source=direct" />
              {swipe(home.direct)}
            </>
          ) : (
            <>
              <SecHead title="직접 소개하고 싶은 글이 있나요?" />
              <Link href="/register" className="home-banner">
                <div className="hb-txt"><b>좋은 글을 찾으셨다면</b><br />인사이터들에게 알려주세요</div>
                <span className="hb-go">글 등록 ›</span>
              </Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
