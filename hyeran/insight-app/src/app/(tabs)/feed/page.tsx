import { createClient } from "@/lib/supabase/server";
import { getFeedPosts, getCompanies, getBookmarkedPostIds } from "@/lib/queries";
import FeedClient from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [posts, companies, bookmarked] = await Promise.all([
    getFeedPosts(),
    getCompanies(),
    user ? getBookmarkedPostIds(user.id) : Promise.resolve(new Set<string>()),
  ]);
  return (
    <>
      <div className="appbar"><span className="title">피드</span></div>
      <div className="pad">
        <FeedClient posts={posts} companies={companies} bookmarked={[...bookmarked]} />
      </div>
    </>
  );
}
