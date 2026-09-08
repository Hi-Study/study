import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFeedPosts, getCompanies, getBookmarkedPostIds, getReadPostIds, getFavoriteCompanyIds } from "@/lib/queries";
import FeedClient from "@/components/FeedClient";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// 홈 통계에서 넘어오는 분류 필터. 시트에서 이어서 조정할 수 있게 초기 선택으로만 넘긴다.
type Sp = {
  tab?: string; company?: string; source?: string;
  kind?: string; pt?: string; it?: string; rc?: string; flag?: string;
};

export default async function FeedPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [posts, companies, bookmarked, readIds, favorites] = await Promise.all([
    getFeedPosts(),
    getCompanies(),
    user ? getBookmarkedPostIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getReadPostIds(user.id) : Promise.resolve(new Set<string>()),
    user ? getFavoriteCompanyIds(user.id) : Promise.resolve(new Set<string>()),
  ]);

  const one = (v?: string) => (v ? [v === "none" ? "__none__" : v] : []);

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/search" className="iconbtn" aria-label="검색"><Icon name="search" /></Link>
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        <FeedClient
          posts={posts}
          companies={companies}
          bookmarked={[...bookmarked]}
          readIds={[...readIds]}
          favorites={[...favorites]}
          initialTab={sp.tab === "bookmark" ? "bookmark" : "all"}
          initialSource={sp.source === "direct" ? "direct" : (sp.company ?? "all")}
          initialClass={{
            kind: one(sp.kind), pt: one(sp.pt), it: one(sp.it),
            rc: one(sp.rc), flag: one(sp.flag),
          }}
        />
      </div>
    </>
  );
}
