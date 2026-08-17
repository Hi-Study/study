import { createClient } from "@/lib/supabase/server";
import { getInsightFeed, getBookmarkedInsightFeed } from "@/lib/queries";
import InsightClient from "@/components/InsightClient";

export const dynamic = "force-dynamic";

export default async function InsightPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [all, bookmarked] = await Promise.all([
    getInsightFeed(user!.id),
    user ? getBookmarkedInsightFeed(user.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="appbar"><span className="title">인사이트</span></div>
      <div className="pad">
        <div className="subhead">인사이터들이 남긴 인사이트를 최신순으로 만나보세요</div>
        <InsightClient all={all} bookmarked={bookmarked} />
      </div>
    </>
  );
}
