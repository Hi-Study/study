import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFeedPosts, getCompanies, getBookmarkedPostIds, getReadPostIds, getFavoriteCompanyIds } from "@/lib/queries";
import FeedClient from "@/components/FeedClient";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// 홈 통계에서 넘어오는 분류 필터 — 그 묶음의 글만 읽어보기 위한 것
type Sp = { tab?: string; company?: string; source?: string;
  kind?: string; pt?: string; it?: string; rc?: string; flag?: string };

export default async function FeedPage({ searchParams }: { searchParams: Promise<Sp> }) {
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
  // 분류 필터 적용 (홈 통계 → 피드). pt=none 은 problem_type 이 비어 있는 글
  const filters: { label: string; fn: (p: (typeof posts)[number]) => boolean }[] = [];
  if (sp.kind) filters.push({ label: sp.kind, fn: (p) => p.article_kind === sp.kind });
  if (sp.pt) filters.push(sp.pt === "none"
    ? { label: "문제 유형 없음", fn: (p) => !p.problem_type }
    : { label: sp.pt, fn: (p) => p.problem_type === sp.pt });
  if (sp.it) filters.push({ label: sp.it, fn: (p) => !!p.impact_targets?.includes(sp.it as never) });
  if (sp.rc) filters.push({ label: `결과: ${sp.rc}`, fn: (p) => p.result_certainty === sp.rc });
  if (sp.flag) filters.push({ label: sp.flag, fn: (p) => !!p.flags?.includes(sp.flag as never) });
  const filtered = filters.length ? posts.filter((p) => filters.every((f) => f.fn(p))) : posts;

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/search" className="iconbtn" aria-label="검색"><Icon name="search" /></Link>
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        {filters.length > 0 && (
          <div className="fbanner">
            <span className="fb-label">{filters.map((f) => f.label).join(" · ")}</span>
            <span className="fb-n">{filtered.length}건</span>
            <Link href="/feed" className="fb-clear">해제</Link>
          </div>
        )}
        <FeedClient
          posts={filtered}
          companies={companies}
          bookmarked={[...bookmarked]}
          readIds={[...readIds]}
          favorites={[...favorites]}
          initialTab={sp.tab === "bookmark" ? "bookmark" : "all"}
          initialSource={sp.source === "direct" ? "direct" : (sp.company ?? "all")}
        />
      </div>
    </>
  );
}
