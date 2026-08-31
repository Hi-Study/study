import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCompanies, getFeedPosts, getFavoriteCompanyIds,
  getReadPostIds, getBookmarkedPostIds, pickPopular,
} from "@/lib/queries";
import BackButton from "@/components/BackButton";
import FavoriteToggle from "@/components/FavoriteToggle";
import CompanySelect from "@/components/CompanySelect";
import DragScroll from "@/components/DragScroll";
import FeedCard from "@/components/FeedCard";
import PostRow from "@/components/PostRow";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const [companies, posts, favSet, readIds, bmIds] = await Promise.all([
    getCompanies(),
    getFeedPosts(),
    getFavoriteCompanyIds(user!.id),
    getReadPostIds(user!.id),
    getBookmarkedPostIds(user!.id),
  ]);

  const company = companies.find((c) => c.slug === slug);
  if (!company) notFound();

  const mark = (p: Post) => ({ ...p, read: readIds.has(p.id), bookmarked: bmIds.has(p.id) });
  const cposts = posts.filter((p) => p.company_id === company.id);
  const popular = pickPopular(cposts, 10);
  const latest = [...cposts].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return (
    <>
      <div className="appbar">
        <BackButton />
        <span className="spacer" />
      </div>
      <div className="pad">
        <div className="co-head">
          <CompanySelect
            current={company} companies={companies} favIds={[...favSet]}
            favorite={<FavoriteToggle companyId={company.id} initial={favSet.has(company.id)} />}
          />
        </div>

        {popular.length > 0 && (
          <section className="hsec">
            <div className="hsec-head"><div className="hsec-title">인기 글</div></div>
            <DragScroll className="swipe">
              {popular.map((p) => <FeedCard key={p.id} post={mark(p)} />)}
            </DragScroll>
          </section>
        )}

        <section className="hsec">
          <div className="hsec-head"><div className="hsec-title">최신 글</div></div>
          {latest.length ? (
            <div className="feed-list">
              {latest.map((p) => <PostRow key={p.id} post={mark(p)} />)}
            </div>
          ) : (
            <div className="empty sm"><div className="msg">아직 수집된 글이 없어요</div></div>
          )}
        </section>
      </div>
    </>
  );
}
