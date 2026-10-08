import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleCard } from "@/components/common/ArticleCard";
import { ReadFilter } from "@/components/common/ReadState";
import { listArticles } from "@/core/shared/db";
import { experienceGroups, internalOf } from "@/core/3-place/home";
import { EXPERIENCE_META, EXPERIENCES, experienceBySlug, INTERNAL_TAG, PRODUCT_PATTERN_LABEL } from "@/core/2-classify/taxonomy";

const WHO = [
  { key: "all", label: "전체" },
  { key: "user", label: "서비스 사용자" },
  { key: "internal", label: INTERNAL_TAG },
] as const;

export default async function ExperiencePage({ params, searchParams }: PageProps<"/experiences/[slug]">) {
  await connection();
  const { slug } = await params;
  const key = experienceBySlug(slug);
  if (!key) notFound();
  const sp = await searchParams;
  const who = sp.who === "user" || sp.who === "internal" ? sp.who : "all";
  const m = EXPERIENCE_META[key];

  const keep = (internal: boolean) => who === "all" || (who === "internal") === internal;
  const all = await listArticles("included");
  const rows = all.filter((a) => keep(internalOf(a)));
  const { groups, related, total } = experienceGroups(rows, key);
  const counts = {
    all: experienceGroups(all, key).total,
    user: experienceGroups(all.filter((a) => !internalOf(a)), key).total,
    internal: experienceGroups(all.filter(internalOf), key).total,
  };

  const whoChips = (
    <div className="flex flex-wrap gap-1.5">
      {WHO.map((w) => (
        <Link
          key={w.key}
          href={w.key === "all" ? `/experiences/${slug}` : `/experiences/${slug}?who=${w.key}`}
          scroll={false}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            who === w.key ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3"
          }`}
        >
          {w.label} {counts[w.key]}
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <Link href="/" className="text-sm text-ink-3">
        ← 홈
      </Link>
      <div className="mt-3 rounded-3xl bg-surface p-6 md:p-8">
        {/* 홈 경험 카드와 같은 문구: 우리 서비스에 비춰 보는 질문 → 전할 경험 → 다른 서비스 사례로 이끄는 질문 */}
        <p className="text-[15px] text-ink-3">{m.when}</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight md:text-[28px]">{m.short}</h1>
        <p className="mt-1 text-[18px] font-bold text-brand">{m.benefit}</p>
      </div>

      {total === 0 && related.length === 0 && (
        <div className="mt-6">
          {whoChips}
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
            아직 이 경험으로 분명하게 묶인 글이 없어요.
          </p>
        </div>
      )}

      {total + related.length > 0 && (
        <div className="mt-6">
          {/* 누구의 경험(왼쪽) + 읽음 여부(오른쪽) 한 줄. 두 필터 모두 이 경험의 사례(STRONG) 수를 센다 */}
          <ReadFilter ids={groups.flatMap((g) => g.items).map((a) => a.id)} leading={whoChips}>
            {total === 0 && (
              <p className="mb-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
                아직 이 경험으로 분명하게 묶인 글이 없어요.
              </p>
            )}
            {groups.map((g) => (
              <section key={g.pattern ?? "etc"} data-card-group className="mt-7 first:mt-0">
                <h2 className="text-lg font-bold">{g.pattern ? PRODUCT_PATTERN_LABEL[g.pattern] : "그 밖의 방식"}</h2>
                <p className="mt-0.5 text-xs text-ink-3">{g.items.length}건</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {g.items.map((a) => (
                    <ArticleCard key={a.id} a={a} showExperience={false} />
                  ))}
                </div>
              </section>
            ))}

            {related.length > 0 && (
              <section data-card-group className="mt-12 border-t border-line pt-8">
                <h2 className="text-lg font-bold">함께 볼 글</h2>
                <p className="mt-0.5 text-sm text-ink-3">이 부담도 일부 덜어줬지만, 주로 다른 이야기를 다룬 글이에요.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {related.map((a) => (
                    <ArticleCard key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}
          </ReadFilter>
        </div>
      )}

      <nav className="mt-14 flex flex-wrap gap-2">
        {EXPERIENCES.filter((k) => k !== key).map((k) => (
          <Link
            key={k}
            href={`/experiences/${EXPERIENCE_META[k].slug}`}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:border-brand hover:text-brand"
          >
            {EXPERIENCE_META[k].short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
