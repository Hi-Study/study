import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { KIND_LABEL } from "@/components/article/kinds";
import { BookmarkButton, MarkRead } from "@/components/article/ArticleActions";
import { ReadToggle } from "@/components/common/ReadState";
import { formatDate } from "@/components/common/ArticleCard";
import { PerspectiveSheet } from "@/components/article/PerspectiveSheet";
import { ReadingDigest } from "@/components/article/ReadingDigest";
import { collectAnnotations, excerptExists } from "@/core/1-analyze/annotate";
import { companyById } from "@/core/0-collect/companies";
import { companyLogo } from "@/core/0-collect/logos";
import { EXPERIENCE_META } from "@/core/2-classify/taxonomy";
import { cls } from "@/core/3-place/home";
import { splitBlocks } from "@/core/0-collect/content";
import { getArticle } from "@/core/shared/db";

export default async function ArticlePage({ params }: PageProps<"/articles/[id]">) {
  await connection();
  const { id } = await params;
  const a = await getArticle(Number(id));
  if (!a) notFound();
  const l = a.learning;
  const c = companyById(a.companyId);
  const logo = companyLogo(a.companyId);
  const k = cls(a);
  // 칩은 쉬운 말인 경험 이름 하나만 — 영어 제품 패턴 이름은 상세 첫 화면에서 뺀다
  const experience = k?.experience && k.fit !== "NONE" ? EXPERIENCE_META[k.experience].short : null;

  // 원문 전체는 싣지 않는다(저작권) — 서버에서 짧은 발췌만 만들어 화면으로 보낸다. 원문은 "원문에서 보기"로 원래 블로그에서 읽는다.
  const anns = l ? collectAnnotations(l) : [];
  // AI 가 고른 핵심 문장 중 원문에 실제로 있는 것만 인용으로 보여 준다(없는 문장은 인용 부호 없이 설명만)
  const keyLines = anns.map((x) => ({ ...x, quoted: !!x.excerpt && excerptExists(a.contentHtml, x.excerpt) }));
  const blocks = splitBlocks(a.contentHtml);
  const guideQuotes = (a.guide?.sections ?? []).map((s) =>
    s.blocks
      .map((n) => blocks[n - 1])
      .filter((b) => b && !b.heading && b.text.length >= 25)
      .map((b) => shortQuote(b.text)),
  );

  return (
    <article className="mx-auto max-w-[720px]">
      <MarkRead id={a.id} />
      {/* 읽는 순서: 어느 회사 글인지 → 핵심 카피 → 원제목 → AI 정리 안내 → 핵심 내용 → 결론(BEFORE → AFTER) */}
      <div className="flex items-center justify-between gap-3">
        <a href={c.blogUrl || a.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white text-sm font-bold"
            style={{ color: c.color }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-6 object-contain" />
            ) : (
              c.name.slice(0, 1)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{c.name} 기술 블로그</span>
            <span className="block text-xs text-ink-3">{formatDate(a.publishedAt)} 발행</span>
          </span>
        </a>
        <span className="flex shrink-0 items-center gap-1.5">
          <ReadToggle id={a.id} />
          <BookmarkButton id={a.id} />
        </span>
      </div>

      {a.status === "excluded" && (
        <p className="mt-4 rounded-xl bg-before p-3 text-sm text-ink-2">
          AI가 기획 관점이 부족하다고 판단해 제외한 글이에요 — {a.exclusionReason}
        </p>
      )}
      {a.status === "pending" && (
        <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-brand">아직 AI 분석 전인 글이에요. 원문만 보여드려요.</p>
      )}

      {/* 원문 제목은 출처 정보로 회사 줄 바로 아래에, AI가 쓴 핵심 카피는 "AI가 정리했어요" 안내와 붙여 둔다 */}
      {l && <p className="mt-5 text-sm leading-relaxed text-ink-3">{a.title}</p>}
      <h1 className={`${l ? "mt-1.5" : "mt-6"} text-[26px] font-bold leading-snug tracking-tight md:text-[30px]`}>
        {l?.hook ?? a.title}
      </h1>

      {l && (
        <>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-3">
            <span className="text-brand">✦</span> AI가 원문을 분석해서 정리했어요 · {l.readingTime}분
          </p>

          <section className="mt-7 border-t border-line pt-6">
            <h2 className="text-sm font-bold text-ink-3">핵심 내용</h2>
            <ul className="mt-2.5 space-y-1.5">
              {l.quickView.summary.map((s) => (
                <li key={s} className="flex gap-2 leading-relaxed text-ink-2">
                  <span className="mt-2.5 size-1 shrink-0 rounded-full bg-ink-3" />
                  {s}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-bold text-ink-3">결론부터 말하면</h2>
            <p className="mt-1.5 text-[18px] font-semibold leading-relaxed">
              {l.conclusion.replace(/^결론부터 말하면[,\s]*/, "")}
            </p>
            <div className="mt-4 rounded-2xl bg-before p-4">
              <p className="text-xs font-bold tracking-wide text-ink-3">BEFORE</p>
              <p className="mt-1 leading-relaxed">{l.before}</p>
            </div>
            <div className="my-1 text-center text-ink-3" aria-hidden>
              ↓
            </div>
            <div className="rounded-2xl bg-after p-4">
              <p className="text-xs font-bold tracking-wide text-[var(--exp-ink)]">AFTER</p>
              <p className="mt-1 leading-relaxed">{l.after}</p>
            </div>
            {experience && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">{experience}</span>
              </div>
            )}
          </section>

          <div className="mt-6">
            <PerspectiveSheet l={l} />
          </div>
        </>
      )}

      {a.guide && (
        <div className="mt-8">
          <ReadingDigest guide={a.guide} quotes={guideQuotes} sourceUrl={a.url} />
        </div>
      )}

      {keyLines.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">원문에서 짚어 볼 문장</h2>
          <p className="mt-1 text-sm text-ink-3">원문의 핵심 문장과, 기획자 관점에서 왜 중요한지예요.</p>
          <ul className="mt-4 space-y-3">
            {keyLines.map((m) => (
              <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${KIND_LABEL[m.kind].chip}`}>{KIND_LABEL[m.kind].label}</span>
                {m.quoted && (
                  <blockquote className="mt-2 border-l-2 border-ink/20 pl-3 text-[15px] leading-relaxed text-ink">
                    &ldquo;{m.excerpt}&rdquo;
                  </blockquote>
                )}
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  <b className="text-ink">{m.title}</b> — {m.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-10 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-ink py-4 text-white transition hover:brightness-125"
      >
        <span className="font-bold">원문에서 보기 ↗</span>
        <span className="text-xs text-white/70">전체 글은 {c.name} 기술 블로그에서 읽어요</span>
      </a>
      <Link href="/feed" className="mt-3 block text-center text-sm text-ink-3">
        ← 피드로 돌아가기
      </Link>
    </article>
  );
}

/** 근거 문장 발췌 — 문단 앞부분을 문장 단위로 120자 안에서 자른다 */
function shortQuote(text: string, max = 120): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("다. "), cut.lastIndexOf("요. "));
  return end > 40 ? cut.slice(0, end + 1).trim() : `${cut.trim()}…`;
}
