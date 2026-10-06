import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleCard } from "@/components/common/ArticleCard";
import { listArticles } from "@/core/shared/db";
import { articlesForTech, cls, techKeywords, techNames } from "@/core/3-place/home";
import { EXPERIENCE_META, EXPERIENCES, TECH_DESC, TECH_LABEL, techBySlug, techSlug } from "@/core/2-classify/taxonomy";

export default async function TechPage({ params, searchParams }: PageProps<"/tech/[slug]">) {
  await connection();
  const { slug } = await params;
  const tech = techBySlug(slug);
  if (!tech) notFound();
  const sp = await searchParams;
  const name = typeof sp.k === "string" ? sp.k : null;

  const all = listArticles("included");
  const mapped = articlesForTech(all, tech);
  const names = techNames(mapped);
  const rows = name ? mapped.filter((a) => a.learning?.technology.some((t) => t.name.trim() === name)) : mapped;

  // 이 기술이 바꾼 경험 — 경험으로 묶인 글만
  const expCounts = EXPERIENCES.map((k) => ({
    key: k,
    count: mapped.filter((a) => cls(a)?.experience === k && cls(a)?.fit !== "NONE").length,
  })).filter((e) => e.count > 0);
  const others = techKeywords(all).filter((t) => t.tech !== tech);

  return (
    <div>
      <Link href="/" className="text-sm text-ink-3">
        ← 홈
      </Link>
      <div className="mt-3 rounded-3xl bg-surface p-6 md:p-8">
        <p className="text-sm font-semibold text-brand">요즘 자주 나오는 기술</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-[28px]"># {TECH_LABEL[tech]}</h1>
        <p className="mt-2 text-ink-2">{TECH_DESC[tech]}</p>
        <p className="mt-4 text-sm text-ink-3">테크 블로그 글 {mapped.length}건</p>

        {expCounts.length > 0 && (
          <div className="mt-5 border-t border-line pt-5">
            <p className="text-sm font-bold">이 기술이 바꾼 경험</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {expCounts.map((e) => (
                <Link
                  key={e.key}
                  href={`/experiences/${EXPERIENCE_META[e.key].slug}`}
                  className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand hover:brightness-95"
                >
                  {EXPERIENCE_META[e.key].emoji} {EXPERIENCE_META[e.key].label} {e.count}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {names.length > 1 && (
        <div className="mt-6">
          <p className="text-xs font-bold text-ink-3">글에 나온 기술 이름</p>
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none md:flex-wrap">
            <Link
              href={`/tech/${slug}`}
              scroll={false}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                !name ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3"
              }`}
            >
              전체 {mapped.length}
            </Link>
            {names.map((n) => (
              <Link
                key={n.label}
                href={`/tech/${slug}?k=${encodeURIComponent(n.label)}`}
                scroll={false}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                  name === n.label ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3"
                }`}
              >
                {n.label}
                {n.count > 1 && <span className="ml-1 text-xs opacity-60">{n.count}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
      {rows.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
          이 키워드로 묶인 글이 아직 없어요.
        </p>
      )}

      {others.length > 0 && (
        <nav className="mt-14">
          <p className="text-sm font-bold">다른 기술</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {others.map((t) => (
              <Link
                key={t.tech}
                href={`/tech/${techSlug(t.tech)}`}
                className="rounded-full bg-surface px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line hover:text-brand hover:ring-brand"
              >
                # {TECH_LABEL[t.tech]} <span className="text-xs text-ink-3">{t.total}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
