import { createClient } from "@/lib/supabase/server";
import { getInsightFeed, getCommunityFeed } from "@/lib/queries";
import InsightClient from "@/components/InsightClient";

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
      <div className="appbar"><span className="title">인사이트</span></div>
      <div className="pad">
        <InsightClient all={all} community={community} />
      </div>
    </>
  );
}
