import { ArticleCard } from "@/components/article-card";
import { EmptyState } from "@/components/empty-state";
import { FilterChipRow, type FilterChipItem } from "@/components/filter-chip-row";
import { NotificationBell } from "@/components/notification-bell";
import { SortDropdown } from "@/components/sort-dropdown";
import { listArticles, searchArticles } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle, listBookmarksByUser } from "@/lib/db/bookmarks";
import { getCompanyBrand } from "@/lib/companies/brand";
import { countCommentsByArticle } from "@/lib/db/comments";
import { countReadsByArticle } from "@/lib/db/reads";
import { createClient } from "@/lib/supabase/server";
import { toArticleCardData } from "@/lib/article-view";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

// 기업 칩 과다 문제(PRD 10.2) 대응 — 자주 쓰는 기업 몇 개만 칩으로 노출하고 나머지는 드롭다운으로.
const MAX_VISIBLE_COMPANY_CHIPS = 5;

export const dynamic = "force-dynamic";

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "전체") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/feed?${qs}` : "/feed";
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; category?: string; sort?: string }>;
}) {
  const { company, category, sort } = await searchParams;
  const activeCompany = company ?? "전체";
  const activeCategory = category ?? "전체";
  const activeSort = sort === "views" ? "views" : "latest";

  const all = await listArticles();

  // 자주 쓰는(글이 많은) 기업 순으로 정렬해 칩으로 노출, 나머지는 "기업 +" 드롭다운으로.
  const companyCounts = new Map<string, number>();
  for (const a of all) companyCounts.set(a.company, (companyCounts.get(a.company) ?? 0) + 1);
  const companiesByFrequency = [...companyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const visibleCompanies = companiesByFrequency.slice(0, MAX_VISIBLE_COMPANY_CHIPS);
  const overflowCompanies = companiesByFrequency.slice(MAX_VISIBLE_COMPANY_CHIPS);

  // 카테고리 칩은 현재 기업 범위 안에 실제로 존재하는 것만 보여준다(빈 칩 방지).
  const scopedArticles = activeCompany === "전체" ? all : all.filter((a) => a.company === activeCompany);
  const categories = [...new Set(scopedArticles.map((a) => a.category))].sort();

  const records = await searchArticles({
    companies: activeCompany === "전체" ? undefined : [activeCompany],
    category: activeCategory === "전체" ? undefined : activeCategory,
  });

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const [bookmarkCounts, commentCounts, myBookmarks, readCounts] = await Promise.all([
    countBookmarksByArticle(),
    countCommentsByArticle(),
    listBookmarksByUser(userKey),
    countReadsByArticle(),
  ]);
  const bookmarkedIds = new Set(myBookmarks.map((b) => b.article_id));

  const sorted = [...records].sort((a, b) => {
    if (activeSort === "views") {
      const diff = (readCounts[b.id] ?? 0) - (readCounts[a.id] ?? 0);
      if (diff !== 0) return diff;
    }
    return b.created_at.localeCompare(a.created_at);
  });

  const articles = sorted.map((a) => toArticleCardData(a, { bookmarkCounts, commentCounts, bookmarkedIds }));

  // 기업을 바꾸면 카테고리 칩 목록 자체가 바뀌므로, 이전 카테고리 필터는 초기화한다.
  const companyChip = (c: string): FilterChipItem => ({
    key: c,
    label: c,
    href: buildQuery({ company: c === "전체" ? undefined : c, sort }),
    selected: c === activeCompany,
    logoUrl: c === "전체" ? undefined : getCompanyBrand(c).logoUrl || undefined,
  });

  return (
    <div>
      <header className="sticky top-0 z-40 border-b bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">피드</h1>
          <NotificationBell />
        </div>

        <div className="mt-3">
          <FilterChipRow
            items={["전체", ...visibleCompanies].map(companyChip)}
            overflowItems={overflowCompanies.map(companyChip)}
            overflowLabel="기업 +"
          />
        </div>

        {categories.length > 0 ? (
          <div className="mt-2">
            <FilterChipRow
              items={["전체", ...categories].map((c) => ({
                key: c,
                label: c,
                href: buildQuery({ company, category: c === "전체" ? undefined : c, sort }),
                selected: c === activeCategory,
              }))}
            />
          </div>
        ) : null}
      </header>

      <div className="flex items-center justify-end px-4 pt-3">
        <SortDropdown
          active={activeSort}
          options={[
            { key: "latest", label: "최신순", href: buildQuery({ company, category, sort: undefined }) },
            { key: "views", label: "조회순", href: buildQuery({ company, category, sort: "views" }) },
          ]}
        />
      </div>

      <div className="mt-2">
        {articles.length === 0 ? (
          <EmptyState
            message="아직 등록된 글이 없어요."
            actionLabel="첫 글 등록하기"
            actionHref="/articles/new"
          />
        ) : (
          articles.map((article) => <ArticleCard key={article.id} article={article} />)
        )}
      </div>
    </div>
  );
}
