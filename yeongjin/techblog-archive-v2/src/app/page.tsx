import Link from "next/link";
import { connection } from "next/server";
import { formatDate } from "@/components/common/ArticleCard";
import { NewArticlesHero, type HeroSlide } from "@/components/home/NewArticlesHero";
import { HomeReadScope } from "@/components/common/ReadState";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { ProblemCard } from "@/components/home/ProblemCard";
import { ProblemRail } from "@/components/home/ProblemRail";
import { TechExplorer, type TechItem } from "@/components/home/TechExplorer";
import { companyById } from "@/core/0-collect/companies";
import { companyLogo } from "@/core/0-collect/logos";
import { countByStatus, listArticles } from "@/core/shared/db";
import { cls, experienceStats, headlineOf, internalOf, latestProblems, techExplorer } from "@/core/3-place/home";
import { EXPERIENCE_META, TECH_LABEL, techSlug } from "@/core/2-classify/taxonomy";

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
  const rows = await listArticles("included");
  const counts = await countByStatus();
  const stats = experienceStats(rows);
  const problems = latestProblems(rows);
  // 기술마다 최신 12건까지 넘긴다 — 화면은 4건을 보여주되, "내가 읽은 글" OFF 면 읽은 글을 빼고 채운다
  const techItems: TechItem[] = techExplorer(rows, 8, 12).map((t) => ({
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

  // 홈 맨 위: 새로 들어온 글 — 최신 4건을 카드 롤링으로 (후보 12건: "내가 읽은 글" OFF 면 안 읽은 글로 채운다)
  const slides: HeroSlide[] = rows.slice(0, 12).map((a) => {
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
      experience: exp ? exp.short : null,
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

      <Section
        title="우리 사용자에게 어떤 경험을 주고 싶나요?"
        sub="경험을 고르면 다른 서비스의 사례를 보여드려요."
      >
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
          <HomeReadScope>
            <ProblemRail>
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
            </ProblemRail>
          </HomeReadScope>
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
