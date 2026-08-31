import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInsightFeed, getCommunityFeed } from "@/lib/queries";
import InsightClient from "@/components/InsightClient";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function InsightPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [all, community] = await Promise.all([
    getInsightFeed(user!.id),
    getCommunityFeed(user!.id),
  ]);

  return (
    <>
      <div className="appbar">
        <span className="title">인사이트</span>
        <span className="spacer" />
        <Link href="/search" className="iconbtn" aria-label="검색"><Icon name="search" /></Link>
      </div>
      <div className="pad">
        <InsightClient all={all} community={community} />
      </div>
    </>
  );
}
