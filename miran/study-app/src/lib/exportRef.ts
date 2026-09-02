// 레퍼런스 문서 내보내기 — 마이 > 활동 캘린더 > 그날의 활동에서 쓴다.
//
// 기획자·마케터가 원하는 건 "며칠 연속 읽었다"가 아니라 **써먹을 자료**다.
// 그날 모은 인사이트·하이라이트·단어를 노션에 그대로 붙일 수 있는 마크다운으로 만든다.
// 순수 함수 — 테스트 대상이고, 화면은 결과 문자열을 클립보드/공유로 넘기기만 한다.
import { toInsight } from "@/lib/insight";

export interface ExportOpinion {
  articleTitle: string;
  blogName?: string | null;
  articleUrl?: string | null;
  insight: unknown; // jsonb 원본 — toInsight 로 정규화해서 쓴다
}
export interface ExportHighlight {
  quote: string | null;
  note: string | null;
  articleTitle?: string | null;
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
  opinions: ExportOpinion[];
  highlights: ExportHighlight[];
  comments: ExportComment[];
  words: ExportWord[];
  reads: ExportRead[];
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

/**
 * 그날의 활동을 레퍼런스 문서(마크다운)로. 비어 있는 섹션은 통째로 뺀다.
 * 활동이 하나도 없으면 빈 문자열을 돌려준다(호출부가 버튼을 비활성화한다).
 */
export function buildReferenceMarkdown(day: DayExport): string {
  const out: string[] = [];
  const total =
    day.opinions.length +
    day.highlights.length +
    day.comments.length +
    day.words.length +
    day.reads.length;
  if (total === 0) return "";

  out.push(`# ${formatExportDate(day.date)} 읽은 레퍼런스`);
  out.push("");

  if (day.opinions.length > 0) {
    out.push("## 남긴 인사이트");
    out.push("");
    for (const o of day.opinions) {
      const i = toInsight(o.insight);
      out.push(`### ${titleLine(o.articleTitle, o.blogName, o.articleUrl)}`);
      if (i.core) out.push(`- **핵심** — ${i.core}`);
      if (i.quote) out.push(`- **인상적인 문장** — "${i.quote}"`);
      if (i.interpretation) out.push(`- **내 해석** — ${i.interpretation}`);
      if (i.apply) out.push(`- **바로 적용할 것** — ${i.apply}`);
      if (i.similar) out.push(`- **비슷한 사례** — ${i.similar}`);
      for (const q of i.questions) out.push(`- **질문** — ${q}`);
      out.push("");
    }
  }

  if (day.highlights.length > 0) {
    out.push("## 밑줄 친 문장");
    out.push("");
    for (const h of day.highlights) {
      const q = clean(h.quote);
      if (q) out.push(`> ${q}`);
      const n = clean(h.note);
      if (n) out.push(`> — ${n}`);
      const t = clean(h.articleTitle);
      if (t) out.push(`> *(${t})*`);
      out.push("");
    }
  }

  if (day.words.length > 0) {
    out.push("## 새로 알게 된 말");
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
    out.push("## 읽은 글");
    out.push("");
    for (const a of day.reads) out.push(`- ${titleLine(a.title, a.blogName, a.url)}`);
    out.push("");
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
