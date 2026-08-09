import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPostsByCompany, getFavoriteCompanyIds, getRecommendedPosts } from "@/lib/queries";
import { SwipeCard, CompanyLogo } from "@/components/PostCard";
import FavoriteToggle from "@/components/FavoriteToggle";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [groups, favs, recommended] = await Promise.all([
    getPostsByCompany(),
    user ? getFavoriteCompanyIds(user.id) : Promise.resolve(new Set<string>()),
    getRecommendedPosts(),
  ]);
  // 즐겨찾기 기업을 앞으로 정렬
  groups.sort((a, b) => Number(favs.has(b.company.id)) - Number(favs.has(a.company.id)));

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">insight</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        <Link href="/search" className="searchbar" style={{ display: "flex" }}>
          <Icon name="search" /><span className="ph">글 제목·기업·태그 검색</span>
        </Link>

        {recommended.length > 0 && (
          <>
            <div className="sec-title">추천 글</div>
            <div className="swipe">
              {recommended.map((p) => <SwipeCard key={p.id} post={p} />)}
            </div>
          </>
        )}

        <div className="sec-title">기술 블로그 모아보기</div>
        {groups.map(({ company, posts }) => (
          <div key={company.id}>
            <div className="comprow">
              <CompanyLogo company={company} />
              <span className="cname">{company.name}</span>
              <FavoriteToggle companyId={company.id} initial={favs.has(company.id)} />
            </div>
            <div className="swipe">
              {posts.map((p) => <SwipeCard key={p.id} post={p} />)}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="empty"><div className="art" /><div className="msg">아직 수집된 글이 없어요</div></div>
        )}
      </div>
    </>
  );
}
