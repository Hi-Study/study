import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getFeedPosts, getCompanies, getFavoriteCompanyIds, getReadPostIds,
  getBookmarkedPostIds, getBookmarkedPosts, pickTodayHero, pickPopular,
} from "@/lib/queries";
import { FeatureCard, CompanyLogo } from "@/components/PostCard";
import FeedCard from "@/components/FeedCard";
import FavoriteToggle from "@/components/FavoriteToggle";
import Icon from "@/components/Icon";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [posts, companies, favs, readIds, bmIds, bookmarkPosts] = await Promise.all([
    getFeedPosts(),
    getCompanies(),
    user ? getFavoriteCompanyIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getReadPostIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getBookmarkedPostIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getBookmarkedPosts(user.id) : Promise.resolve([] as Post[]),
  ]);
  const mark = <T extends { id: string }>(p: T) => ({ ...p, read: readIds.has(p.id), bookmarked: bmIds.has(p.id) });

  const hero = pickTodayHero(posts);
  const popular = pickPopular(posts, 10, hero?.id).map(mark);
  const bookmarks = bookmarkPosts.map(mark);
  const byCompany = companies
    .map((c) => ({ company: c, posts: posts.filter((p) => p.company_id === c.id).slice(0, 8).map(mark) }))
    .filter((g) => g.posts.length > 0)
    .sort((a, b) => Number(favs.has(b.company.id)) - Number(favs.has(a.company.id)));

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

        {/* 1. 오늘의 글 */}
        {hero && (
          <section className="hsec">
            <div className="hsec-head">
              <div>
                <div className="hsec-title">오늘의 글</div>
                <div className="hsec-sub">최근 일주일 가장 많이 읽힌 글</div>
              </div>
            </div>
            <FeatureCard post={mark(hero)} />
          </section>
        )}

        {/* 2. 인기 글 */}
        {popular.length > 0 && (
          <section className="hsec">
            <div className="hsec-head">
              <div>
                <div className="hsec-title">인기 있는 글</div>
                <div className="hsec-sub">인사이트가 많이 쌓인 글</div>
              </div>
            </div>
            <div className="pop-grid">
              {popular.map((p) => <FeedCard key={p.id} post={p} />)}
            </div>
          </section>
        )}

        {/* 3. 북마크 글 */}
        <section className="hsec">
          <div className="hsec-head">
            <div>
              <div className="hsec-title">내가 북마크한 글</div>
              <div className="hsec-sub">저장해 둔 글 모아보기</div>
            </div>
            {bookmarks.length > 0 && <Link href="/feed?tab=bookmark" className="see-all">전체보기</Link>}
          </div>
          {bookmarks.length > 0 ? (
            <div className="swipe">{bookmarks.map((p) => <FeedCard key={p.id} post={p} />)}</div>
          ) : (
            <div className="empty sm">
              <div className="msg">북마크한 글이 여기 모여요</div>
              <div className="sub">마음에 드는 글에 북마크를 눌러보세요</div>
              <Link href="/feed" className="btn btn-outline seeall-btn">피드 둘러보기</Link>
            </div>
          )}
        </section>

        {/* 4. 기업별 글 */}
        <section className="hsec">
          <div className="hsec-head">
            <div>
              <div className="hsec-title">기업별 기술블로그</div>
              <div className="hsec-sub">기업별 최신 글 모아보기</div>
            </div>
          </div>
          {byCompany.map(({ company, posts }) => (
            <div key={company.id} className="co-block">
              <div className="comprow">
                <CompanyLogo company={company} />
                <span className="cname">{company.name}</span>
                <FavoriteToggle companyId={company.id} initial={favs.has(company.id)} />
                <span style={{ flex: 1 }} />
                <Link href={`/feed?company=${company.id}`} className="see-all">전체보기</Link>
              </div>
              <div className="swipe">{posts.map((p) => <FeedCard key={p.id} post={p} />)}</div>
            </div>
          ))}
          {byCompany.length === 0 && (
            <div className="empty"><div className="art" /><div className="msg">아직 수집된 글이 없어요</div></div>
          )}
        </section>
      </div>
    </>
  );
}
