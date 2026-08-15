import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFeedPosts, getCompanies, getBookmarkedPostIds, getReadPostIds, getFavoriteCompanyIds } from "@/lib/queries";
import FeedClient from "@/components/FeedClient";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string; company?: string }> }) {
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
  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
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
          initialCompany={sp.company ?? "all"}
        />
      </div>
    </>
  );
}
