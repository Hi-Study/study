import { createClient } from "@/lib/supabase/server";
import { getFeedPosts, getCompanies, getReadPostIds } from "@/lib/queries";
import BackButton from "@/components/BackButton";
import SearchClient from "@/components/SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [posts, companies, readIds] = await Promise.all([
    getFeedPosts(),
    getCompanies(),
    user ? getReadPostIds(user.id) : Promise.resolve(new Set<string>()),
  ]);
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title">검색</span></div>
      <SearchClient posts={posts} companies={companies} readIds={[...readIds]} />
    </div>
  );
}
