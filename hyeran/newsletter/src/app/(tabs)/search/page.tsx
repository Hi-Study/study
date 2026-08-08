import Link from "next/link";
import Icon from "@/components/Icon";
import SearchClient from "@/components/SearchClient";
import { getFeedPosts } from "@/lib/queries";

export default async function SearchPage() {
  const posts = await getFeedPosts();

  return (
    <>
      <div className="top">
        <Link href="/home" className="icon-btn" aria-label="뒤로">
          <Icon name="back" />
        </Link>
        <span className="title">검색</span>
        <span className="spacer-36" />
      </div>
      <SearchClient posts={posts} />
    </>
  );
}
