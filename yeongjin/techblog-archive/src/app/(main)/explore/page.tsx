import Link from "next/link";
import { auth } from "@/lib/auth";
import { getExploreFeed, getCompanies } from "@/lib/queries";
import { CATEGORY_OPTIONS } from "@/lib/labels";
import { PostCard } from "@/components/PostCard";
import type { Category } from "@/generated/prisma/enums";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; category?: string }>;
}) {
  const { company, category } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const [posts, companies] = await Promise.all([
    getExploreFeed({
      currentUserId: userId,
      companySlug: company,
      category: category as Category | undefined,
    }),
    getCompanies(),
  ]);

  const buildHref = (params: { company?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params.company) sp.set("company", params.company);
    if (params.category) sp.set("category", params.category);
    const qs = sp.toString();
    return `/explore${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">탐색</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            자동 수집 글과 팀원 등록 글이 함께 모이는 최신순 피드
          </p>
        </div>
        <Link
          href="/posts/new"
          className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
        >
          + 글 등록
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={!category} href={buildHref({ company })}>
          전체
        </Chip>
        {CATEGORY_OPTIONS.map(([value, label]) => (
          <Chip key={value} active={category === value} href={buildHref({ company, category: value })}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={!company} href={buildHref({ category })}>
          전체 회사
        </Chip>
        {companies.map((c) => (
          <Chip key={c.id} active={company === c.slug} href={buildHref({ company: c.slug, category })}>
            {c.name}
          </Chip>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-white"
          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
      아직 아카이빙된 글이 없습니다. RSS 자동 수집을 실행하거나 첫 글을 등록해보세요.
    </div>
  );
}
