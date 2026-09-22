// 레퍼런스 문서 내보내기 — 마이 > 활동 캘린더 > 그날의 활동에서 쓴다.
//
// 기획자가 원하는 건 "며칠 연속 읽었다"가 아니라 **노션에 그대로 붙는 자료**다.
// 그래서 출력은 **글 하나 = 블록 하나**인 템플릿이다(PRODUCT.md §2.5):
//
//   ## 1. 제목 — 기업
//   한 줄 요약 → 1분 이해 → 내가 남긴 인사이트 → 알아두면 좋은 용어 → 하이라이트 → 링크
//
// 예전 형식은 활동 종류별(인사이트 / 밑줄 / 단어 / 읽은 글)로 섹션을 나눴다. 버렸다 —
// 붙여넣고 나면 **같은 글의 조각이 네 군데로 흩어져** 나중에 무슨 글 얘긴지 알 수 없었다.
// 자료로 쓰이는 단위는 활동이 아니라 **글**이다.
//
// 읽기만 한 글은 맨 뒤에 링크 목록으로 몰아 둔다 — 자료가 아니라 기록이라서,
// 본문에 섞이면 정작 읽을 블록이 묻힌다.
//
// 순수 함수다. 화면은 결과 문자열을 클립보드/공유로 넘기기만 한다.
import { toInsight } from "@/lib/insight";

/** 글 하나에 딸린 그날의 자료 전부. 화면에서 글 단위로 묶어서 넘긴다. */
export interface ExportArticleRef {
  title: string;
  blogName?: string | null;
  url?: string | null;
  /** 한 줄 요약 — 읽기 가이드의 summary, 없으면 글 요약. */
  oneLine?: string | null;
  /** 1분 이해 — 질문과 답을 짝으로. 라벨은 화면(lib/guide.leadRows)에서 정한 것을 그대로 쓴다. */
  lead?: { q: string; a: string }[];
  /** 기획 포인트 — 원문에 판단·트레이드오프가 없으면 비어 있다. */
  plannerPoint?: string | null;
  /** 알아두면 좋은 용어. */
  terms?: { term: string; plain: string }[];
  /** 그날 이 글에 남긴 인사이트(jsonb 원본 — toInsight 로 정규화해서 쓴다). */
  insights?: unknown[];
  /** 그날 이 글에 그은 밑줄. */
  highlights?: { quote: string | null; note: string | null }[];
}

export interface ExportComment {
  text: string;
  sourceTitle?: string | null;
}
export interface ExportWord {
  term: string;
  definition?: string | null;
}
export interface ExportRead {
  title: string;
  blogName?: string | null;
  url?: string | null;
}

export interface DayExport {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 인사이트나 밑줄을 남긴 글 — 문서의 본체. */
  articles: ExportArticleRef[];
  /** 읽기만 한 글 — 맨 뒤 링크 목록. */
  reads: ExportRead[];
  /** 그날 담은 단어(글과 무관하게 단어장에 담은 것). */
  words: ExportWord[];
  /** 그날 남긴 댓글. */
  comments: ExportComment[];
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

/** 'YYYY-MM-DD' → '2026년 9월 1일'. 잘못된 값이면 원문 그대로. */
export function formatExportDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${y}년 ${m}월 ${d}일`;
}

/** 제목 + 출처를 한 줄로. 원문 링크가 있으면 마크다운 링크로. */
function titleLine(title: string, blogName?: string | null, url?: string | null): string {
  const t = clean(title) || "(제목 없음)";
  const linked = clean(url) ? `[${t}](${clean(url)})` : t;
  const src = clean(blogName);
  return src ? `${linked} — ${src}` : linked;
}

/** 글 하나를 노션 블록으로. 비어 있는 칸은 통째로 뺀다. */
function articleBlock(a: ExportArticleRef, n: number): string[] {
  const out: string[] = [];
  const src = clean(a.blogName);
  out.push(`## ${n}. ${clean(a.title) || "(제목 없음)"}${src ? ` — ${src}` : ""}`);
  out.push("");

  const one = clean(a.oneLine);
  if (one) {
    out.push(`**한 줄 요약**`);
    out.push(one);
    out.push("");
  }

  const lead = (a.lead ?? []).filter((r) => clean(r.q) && clean(r.a));
  if (lead.length > 0) {
    out.push(`**1분 이해**`);
    for (const r of lead) out.push(`- **${clean(r.q)}** ${clean(r.a)}`);
    out.push("");
  }

  const point = clean(a.plannerPoint);
  if (point) {
    out.push(`**기획 포인트**`);
    out.push(point);
    out.push("");
  }

  const insights = (a.insights ?? []).map(toInsight);
  const written = insights.filter(
    (i) =>
      i.core || i.apply || i.hypothesis || i.quote || i.interpretation || i.similar || i.questions.length > 0,
  );
  if (written.length > 0) {
    out.push(`**내가 남긴 인사이트**`);
    for (const i of written) {
      // 답은 **질문과 짝으로** 나간다 — 답만 옮겨 두면 나중에 읽는 사람이
      //   무슨 질문에 답한 말인지 모른다(화면도 같은 규칙, InsightBody).
      const pair = (label: string, q: string | undefined, v: string) => {
        if (!v) return;
        if (!q) {
          out.push(`- **${label}** — ${v}`);
          return;
        }
        out.push(`- **${label}**`);
        out.push(`    - Q. ${q}`);
        out.push(`    - → ${v}`);
      };
      pair("핵심", i.coreQ, i.core);
      pair("바로 적용할 것", i.applyQ, i.apply);
      pair("이들의 가설", i.hypothesisQ, i.hypothesis ?? "");
      if (i.interpretation) out.push(`- **내 해석** — ${i.interpretation}`);
      if (i.quote) out.push(`- **인상적인 문장** — "${i.quote}"`);
      if (i.similar) out.push(`- **비슷한 사례** — ${i.similar}`);
      for (const q of i.questions) out.push(`- **질문** — ${q}`);
    }
    out.push("");
  }

  const terms = (a.terms ?? []).filter((t) => clean(t.term) && clean(t.plain));
  if (terms.length > 0) {
    out.push(`**알아두면 좋은 용어**`);
    for (const t of terms) out.push(`- **${clean(t.term)}** — ${clean(t.plain)}`);
    out.push("");
  }

  const highlights = (a.highlights ?? []).filter((h) => clean(h.quote) || clean(h.note));
  if (highlights.length > 0) {
    out.push(`**하이라이트**`);
    for (const h of highlights) {
      const q = clean(h.quote);
      if (q) out.push(`> ${q}`);
      const note = clean(h.note);
      if (note) out.push(`> — ${note}`);
      out.push("");
    }
  }

  const url = clean(a.url);
  if (url) {
    out.push(`**링크** — [원문 보기](${url})`);
    out.push("");
  }
  return out;
}

/**
 * 그날의 활동을 레퍼런스 문서(마크다운)로. 비어 있는 섹션은 통째로 뺀다.
 * 활동이 하나도 없으면 빈 문자열을 돌려준다(호출부가 버튼을 안 그린다).
 */
export function buildReferenceMarkdown(day: DayExport): string {
  const articles = (day.articles ?? []).filter(
    (a) =>
      clean(a.title) ||
      (a.insights ?? []).length > 0 ||
      (a.highlights ?? []).length > 0,
  );
  const total = articles.length + day.reads.length + day.words.length + day.comments.length;
  if (total === 0) return "";

  const out: string[] = [];
  out.push(`# ${formatExportDate(day.date)} 읽은 레퍼런스`);
  out.push("");

  articles.forEach((a, i) => out.push(...articleBlock(a, i + 1)));

  if (day.words.length > 0) {
    out.push("## 담은 단어");
    out.push("");
    for (const w of day.words) {
      const def = clean(w.definition);
      out.push(def ? `- **${clean(w.term)}** — ${def}` : `- **${clean(w.term)}**`);
    }
    out.push("");
  }

  if (day.comments.length > 0) {
    out.push("## 남긴 댓글");
    out.push("");
    for (const m of day.comments) {
      const src = clean(m.sourceTitle);
      out.push(src ? `- ${clean(m.text)} *(${src})*` : `- ${clean(m.text)}`);
    }
    out.push("");
  }

  if (day.reads.length > 0) {
    out.push("## 읽기만 한 글");
    out.push("");
    for (const a of day.reads) out.push(`- ${titleLine(a.title, a.blogName, a.url)}`);
    out.push("");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
