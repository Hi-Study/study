import { getFeedPosts, getCompanies } from "@/lib/queries";
import BackButton from "@/components/BackButton";
import SearchClient from "@/components/SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const [posts, companies] = await Promise.all([getFeedPosts(), getCompanies()]);
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title">검색</span></div>
      <SearchClient posts={posts} companies={companies} />
    </div>
  );
}
