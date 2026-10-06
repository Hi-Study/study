import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleBody, KIND_LABEL } from "@/components/article/ArticleBody";
import { BookmarkButton, MarkRead } from "@/components/article/ArticleActions";
import { CompanyBadge, formatDate } from "@/components/common/ArticleCard";
import { PerspectiveSheet } from "@/components/article/PerspectiveSheet";
import { ReadingDigest } from "@/components/article/ReadingDigest";
import { annotateHtml, collectAnnotations } from "@/core/1-analyze/annotate";
import { companyById } from "@/core/0-collect/companies";
import { splitBlocks } from "@/core/0-collect/content";
import { getArticle } from "@/core/shared/db";

export default async function ArticlePage({ params }: PageProps<"/articles/[id]">) {
  await connection();
  const { id } = await params;
  const a = getArticle(Number(id));
  if (!a) notFound();
  const l = a.learning;
  const c = companyById(a.companyId);

  const anns = l ? collectAnnotations(l) : [];
  const { html, missed } = annotateHtml(a.contentHtml, anns);
  // 블록 번호는 분석 때와 같아야 한다 — 하이라이트(<mark>)는 인라인이라 블록 구조를 바꾸지 않는다
  const blocks = splitBlocks(html);
  const plainBlocks = splitBlocks(a.contentHtml).map((b) => ({ n: b.n, text: b.text, heading: b.heading }));
  const found = anns.filter((x) => !missed.includes(x));

  return (
    <article className="mx-auto max-w-[720px]">
      <MarkRead id={a.id} />
      <div className="flex items-center justify-between">
        <CompanyBadge id={a.companyId} size="md" />
        <BookmarkButton id={a.id} />
      </div>

      {a.status === "excluded" && (
        <p className="mt-4 rounded-xl bg-before p-3 text-sm text-ink-2">
          AI가 기획 관점이 부족하다고 판단해 제외한 글이에요 — {a.exclusionReason}
        </p>
      )}
      {a.status === "pending" && (
        <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-brand">아직 AI 분석 전인 글이에요. 원문만 보여드려요.</p>
      )}

      <h1 className="mt-4 text-[26px] font-bold leading-snug tracking-tight md:text-[30px]">{l?.hook ?? a.title}</h1>
      {l && <p className="mt-2 text-[15px] text-ink-3">{a.title}</p>}

      {l && (
        <>
          <ul className="mt-5 space-y-1.5">
            {l.quickView.summary.map((s) => (
              <li key={s} className="flex gap-2 leading-relaxed text-ink-2">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-ink-3" />
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 border-y border-line py-3 text-sm text-ink-3">
            <span className="text-brand">✦</span> AI가 원문을 분석해서 정리했어요 · {l.readingTime}분
            <span className="ml-auto">{l.difficulty} · {l.audience}</span>
          </p>

          <section className="mt-6">
            <p className="text-sm font-bold text-ink-3">결론부터 말하면</p>
            <p className="mt-1.5 text-[18px] font-semibold leading-relaxed">
              {l.conclusion.replace(/^결론부터 말하면[,\s]*/, "")}
            </p>
          </section>

          <section className="mt-5 rounded-2xl bg-[#eaf2ff] p-5">
            <p className="text-sm font-bold text-[#1d4ed8]">달라진 경험</p>
            <p className="mt-1.5 leading-relaxed">{l.after}</p>
          </section>
        </>
      )}

      <a
        href={c.blogUrl || a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <span className="grid size-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: c.color }}>
          {c.name.slice(0, 1)}
        </span>
        <span>
          <span className="block font-bold">{c.name} 기술 블로그</span>
          <span className="text-sm text-ink-3">{formatDate(a.publishedAt)} 발행</span>
        </span>
      </a>

      {l && (
        <div className="mt-5">
          <PerspectiveSheet l={l} />
        </div>
      )}

      {a.guide && (
        <div className="mt-8">
          <ReadingDigest guide={a.guide} blocks={plainBlocks} />
        </div>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
          <h2 className="text-xl font-bold">원문 전체</h2>
          {found.length > 0 && (
            <div className="flex gap-3 text-xs text-ink-2">
              {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`size-2.5 rounded-sm ${KIND_LABEL[k].dot}`} />
                  {KIND_LABEL[k].label}
                </span>
              ))}
            </div>
          )}
        </div>
        {found.length > 0 && <p className="mt-2 text-xs text-ink-3">색칠된 문장을 누르면 관점 설명이 나와요.</p>}

        {missed.length > 0 && (
          <details className="mt-4 rounded-2xl bg-bg p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-2">
              본문 위치를 정확히 표시하지 못한 관점 {missed.length}개
            </summary>
            <ul className="mt-3 space-y-2">
              {missed.map((m) => (
                <li key={m.id} className="text-sm leading-relaxed">
                  <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${KIND_LABEL[m.kind].chip}`}>
                    {KIND_LABEL[m.kind].label}
                  </span>
                  <b>{m.title}</b> — {m.body}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-6">
          <ArticleBody blocks={blocks.map((b) => ({ n: b.n, html: b.html }))} anns={found} />
        </div>
      </section>

      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-10 flex items-center justify-center rounded-2xl border border-line bg-surface py-4 font-semibold hover:border-ink-3"
      >
        원문에서 보기 ↗
      </a>
      <Link href="/feed" className="mt-3 block text-center text-sm text-ink-3">
        ← 피드로 돌아가기
      </Link>
    </article>
  );
}
