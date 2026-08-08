import { getFeedPosts, getCompanies } from "@/lib/queries";
import FeedClient from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const [posts, companies] = await Promise.all([getFeedPosts(), getCompanies()]);
  return (
    <>
      <div className="appbar"><span className="title">피드</span></div>
      <div className="pad">
        <FeedClient posts={posts} companies={companies} />
      </div>
    </>
  );
}
