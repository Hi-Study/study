import { ArticleMiniCard } from "@/components/article-mini-card";
import { EmptyState } from "@/components/empty-state";
import { FilterChipRow } from "@/components/filter-chip-row";
import { HeroCarousel } from "@/components/hero-carousel";
import { NotificationBell } from "@/components/notification-bell";
import { listArticles } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle, listBookmarksByUser } from "@/lib/db/bookmarks";
import { getCompanyBrand } from "@/lib/companies/brand";
import { countCommentsByArticle } from "@/lib/db/comments";
import { createClient } from "@/lib/supabase/server";
import { toArticleCardData } from "@/lib/article-view";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";
const MOCK_DISPLAY_NAME = "미리보기 사용자";

export const dynamic = "force-dynamic";

function buildCompanyToggleHref(company: string, selected: string[]): string {
  const next = selected.includes(company)
    ? selected.filter((c) => c !== company)
    : [...selected, company];
  return next.length === 0 ? "/home" : `/home?companies=${encodeURIComponent(next.join(","))}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ companies?: string }>;
}) {
  const { companies: companiesParam } = await searchParams;
  const selectedCompanies = companiesParam
    ? companiesParam.split(",").filter(Boolean)
    : [];

  const all = await listArticles();
  const companies = [...new Set(all.map((a) => a.company))].sort();

  let userKey = PREVIEW_USER_KEY;
  let displayName = MOCK_DISPLAY_NAME;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userKey = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      displayName = profile?.display_name ?? user.email ?? MOCK_DISPLAY_NAME;
    }
  }

  const [bookmarkCounts, commentCounts, myBookmarks] = await Promise.all([
    countBookmarksByArticle(),
    countCommentsByArticle(),
    listBookmarksByUser(userKey),
  ]);
  const bookmarkedIds = new Set(myBookmarks.map((b) => b.article_id));
  const toCard = (a: (typeof all)[number]) =>
    toArticleCardData(a, { bookmarkCounts, commentCounts, bookmarkedIds });

  // 추천 글: 개인화 추천 엔진 이전 단계라 북마크가 많은 순 → 최신순으로 대체한다.
  const recommended = [...all]
    .sort((a, b) => {
      const diff = (bookmarkCounts[b.id] ?? 0) - (bookmarkCounts[a.id] ?? 0);
      return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at);
    })
    .slice(0, 6);

  const companiesToShow = selectedCompanies.length > 0 ? selectedCompanies : companies;
  const rows = companiesToShow
    .map((company) => ({ company, articles: all.filter((a) => a.company === company) }))
    .filter((row) => row.articles.length > 0);

  return (
    <div>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-semibold">홈</h1>
        <NotificationBell />
      </header>

      {all.length === 0 ? (
        <EmptyState
          message="아직 등록된 글이 없어요."
          actionLabel="첫 글 등록하기"
          actionHref="/articles/new"
        />
      ) : (
        <div className="flex flex-col gap-6 py-4">
          <section>
            <h2 className="px-4 text-lg font-bold">{displayName}님을 위해 모아봤어요</h2>
            <div className="mt-3">
              <HeroCarousel articles={recommended.map(toCard)} />
            </div>
          </section>

          <section>
            <h2 className="px-4 text-sm font-semibold text-muted-foreground">기업별로 보기</h2>
            <div className="mt-2 px-4">
              <FilterChipRow
                items={[
                  selectedCompanies.length === 0
                    ? { key: "__all__", label: "전체", href: "/home", selected: true }
                    : { key: "__reset__", label: "초기화", href: "/home", selected: false },
                  ...companies.map((c) => ({
                    key: c,
                    label: c,
                    href: buildCompanyToggleHref(c, selectedCompanies),
                    selected: selectedCompanies.includes(c),
                    logoUrl: getCompanyBrand(c).logoUrl || undefined,
                  })),
                ]}
              />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            {rows.map(({ company, articles }) => (
              <div key={company}>
                <h3 className="px-4 text-sm font-medium">{company}</h3>
                <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                  {articles.map((a) => (
                    <ArticleMiniCard key={a.id} article={toCard(a)} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
