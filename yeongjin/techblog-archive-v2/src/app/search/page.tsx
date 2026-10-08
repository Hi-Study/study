import Link from "next/link";
import { connection } from "next/server";
import { ArticleCard } from "@/components/common/ArticleCard";
import { ReadFilter } from "@/components/common/ReadState";
import { SearchBox } from "@/components/common/SearchBox";
import { listArticles, searchArticles } from "@/core/shared/db";
import { allTags } from "@/core/3-place/home";
import { EXPERIENCE_META, EXPERIENCES } from "@/core/2-classify/taxonomy";

/** "이런 관점은 어때요?" — 기술명이 아니라 질문으로 시작하는 추천 */
const SUGGESTIONS: { label: string; href: string }[] = [
  ...EXPERIENCES.map((k) => ({ label: EXPERIENCE_META[k].question, href: `/experiences/${EXPERIENCE_META[k].slug}` })),
  { label: "AI에게 어디까지 맡길까?", href: `/search?q=${encodeURIComponent("AI")}` },
  { label: "실험으로 어떻게 판단할까?", href: `/search?q=${encodeURIComponent("실험")}` },
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const results = q ? await searchArticles(q) : [];
  const tags = q ? [] : allTags(await listArticles("included"), 16);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">검색</h1>
      <div className="mt-5">
        <SearchBox key={q} initial={q} />
      </div>

      {!q && (
        <>
          <section className="mt-10">
            <h2 className="text-lg font-bold">이런 관점은 어때요?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] hover:border-brand hover:text-brand"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </section>
          {tags.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">많이 쓰인 관점 태그</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Link
                    key={t.label}
                    href={`/search?q=${encodeURIComponent(t.label)}`}
                    className="rounded-md bg-surface px-2.5 py-1 text-sm text-ink-2 hover:text-brand"
                  >
                    #{t.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {q && (
        <section className="mt-8">
          <p className="text-sm text-ink-3">
            <b className="text-ink">‘{q}’</b> 관련 글 {results.length}건
          </p>
          {results.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
              맞는 글이 없어요. 기술 이름 대신 사용자가 겪는 문제로 검색해 보세요.
            </p>
          ) : (
            <div className="mt-3">
              <ReadFilter ids={results.map((a) => a.id)}>
                <div className="grid gap-3 md:grid-cols-2">
                  {results.map((a) => (
                    <ArticleCard key={a.id} a={a} />
                  ))}
                </div>
              </ReadFilter>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
