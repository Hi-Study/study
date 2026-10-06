import Link from "next/link";
import { connection } from "next/server";
import { formatDate } from "@/components/common/ArticleCard";
import { NewArticlesHero, type HeroSlide } from "@/components/home/NewArticlesHero";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { ProblemCard } from "@/components/home/ProblemCard";
import { TechExplorer, type TechItem } from "@/components/home/TechExplorer";
import { companyById } from "@/core/0-collect/companies";
import { companyLogo } from "@/core/0-collect/logos";
import { countByStatus, listArticles } from "@/core/shared/db";
import { cls, experienceStats, headlineOf, internalOf, latestProblems, techExplorer } from "@/core/3-place/home";
import { EXPERIENCE_META, PRODUCT_PATTERN_SHORT, TECH_LABEL, techSlug } from "@/core/2-classify/taxonomy";

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function Home() {
  await connection();
  const rows = listArticles("included");
  const counts = countByStatus();
  const stats = experienceStats(rows);
  const problems = latestProblems(rows);
  const techItems: TechItem[] = techExplorer(rows).map((t) => ({
    slug: techSlug(t.tech),
    label: TECH_LABEL[t.tech],
    total: t.total,
    articles: t.articles.map((a) => ({
      id: a.id,
      headline: headlineOf(a),
      company: companyById(a.companyId).name,
      date: formatDate(a.publishedAt),
      logo: companyLogo(a.companyId),
      color: companyById(a.companyId).color,
    })),
  }));

  // 홈 맨 위: 새로 들어온 글 — 최신 4건을 카드 롤링으로
  const slides: HeroSlide[] = rows.slice(0, 4).map((a) => {
    const c = cls(a);
    const co = companyById(a.companyId);
    const exp = c?.experience && c.fit !== "NONE" ? EXPERIENCE_META[c.experience] : null;
    return {
      id: a.id,
      headline: headlineOf(a),
      title: a.title,
      company: co.name,
      color: co.color,
      logo: companyLogo(a.companyId),
      thumbnail: a.thumbnail,
      experience: exp ? exp.label : null,
      internal: internalOf(a),
      date: formatDate(a.publishedAt),
    };
  });

  return (
    <div>
      <h1 className="sr-only">관점 아카이브 — 요즘 서비스는 어떤 문제를 기술로 풀고 있을까요?</h1>
      <NewArticlesHero slides={slides} />
      <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
        <span>
          국내 테크 블로그 글 <b className="text-ink-2">{counts.included}</b>건을 사용자가 덜게 된 부담으로 다시 묶었어요.
        </span>
        <Link href="/excluded" className="underline underline-offset-4 hover:text-brand">
          제외된 글 {counts.excluded}
        </Link>
      </p>

      <Section title="어떤 변화가 궁금한가요?" sub="테크 블로그 속 서비스들이 덜어준 부담을 골라보세요.">
        <ExperienceCarousel
          slides={stats
            .filter((s) => s.total > 0)
            .map((s) => {
              const m = EXPERIENCE_META[s.key];
              return {
                slug: m.slug,
                when: m.when,
                short: m.short,
                benefit: m.benefit,
                total: s.total,
                companies: s.companies,
                pattern: s.topPattern ? PRODUCT_PATTERN_SHORT[s.topPattern] : null,
                recent: s.recent,
                example: s.example
                  ? { id: s.example.id, headline: headlineOf(s.example), company: companyById(s.example.companyId).name }
                  : null,
              };
            })}
        />
        {stats.some((s) => s.total === 0) && (
          <p className="mt-3 text-xs text-ink-3">
            아직 사례가 모이지 않은 경험 ·{" "}
            {stats
              .filter((s) => s.total === 0)
              .map((s) => EXPERIENCE_META[s.key].short)
              .join(", ")}
          </p>
        )}
      </Section>

      {problems.length > 0 && (
        <Section title="이런 문제를 어떻게 풀었을까요?" sub="서비스가 마주한 문제부터 살펴보세요.">
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {problems.map(({ article, title, summary }) => {
              const c = companyById(article.companyId);
              return (
                <ProblemCard
                  key={article.id}
                  id={article.id}
                  company={c.name}
                  color={c.color}
                  logo={companyLogo(article.companyId)}
                  title={title}
                  summary={summary}
                />
              );
            })}
          </div>
        </Section>
      )}

      {techItems.length > 0 && (
        <Section title="요즘 자주 나오는 기술" sub="기술을 고르면 그 기술을 다룬 테크 블로그 글을 모아 보여드려요.">
          <TechExplorer items={techItems} />
        </Section>
      )}

      <Link
        href="/feed"
        className="mt-12 flex items-center justify-center rounded-2xl border border-line bg-surface py-4 font-semibold hover:border-ink-3"
      >
        전체 글 보기 →
      </Link>
    </div>
  );
}
