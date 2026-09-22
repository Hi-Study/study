// 읽기 블록 — 본문을 "읽기 좋은 덩어리"(문단·소제목·목록·코드)로 묶는다.
//
// ⚠️ 이 파일은 앱의 `src/lib/text.ts` 를 **그대로 옮긴 것**이다. 두 벌인 이유는 엣지(Deno)가
//    앱 소스를 import 할 수 없어서다. 규칙이 갈라지면 가이드가 가리키는 블록 번호와
//    화면이 그리는 블록 번호가 어긋나 **엉뚱한 문단에 제목이 붙는다.**
//    한쪽을 고치면 반드시 다른 쪽도 고치고, 앱 쪽 테스트(src/lib/__tests__/text.test.ts)를 돌린다.

export type BlockKind = "para" | "heading" | "list" | "code";
export interface ReadingBlock {
  kind: BlockKind;
  items: { index: number; seg: string }[];
}

export function splitSentences(text: string): string[] {
  if (!text) return [];
  const parts = text.match(/[^.!?\n]*(?:[.!?]+|\n+|$)/g) ?? [text];
  return parts.filter((p) => p.length > 0);
}

const CODEY: RegExp[] = [
  /^\s*(#|\/\/|--|\/\*|\*\/|[{}<>])/,
  /[_;`]/,
  /\w\(/,
  /=>|::|\{\{|\}\}/,
  /\b(SELECT|FROM|WHERE|JOIN|CAST|INSERT|UPDATE|DELETE|CREATE|GROUP BY|ORDER BY)\b/,
  /^(const|let|var|function|import|export|class|def|return|if|for)\s/,
  /^[A-Za-z_][\w.-]*\s*:\s*(["'[{]|$)/,
];

export function looksLikeCode(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CODEY.some((re) => re.test(t));
}

export function classifyReadingBlock(text: string): BlockKind {
  const t = text.trim();
  if (/^\s*([-–—•·*]|\d+[.)])\s+/.test(t)) return "list";
  if (looksLikeCode(t)) return "code";
  if (t.length >= 2 && t.length <= 28 && !/[.!?…,]$/.test(t)) return "heading";
  return "para";
}

function mergeCodeRuns(blocks: ReadingBlock[]): ReadingBlock[] {
  const out: ReadingBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].kind !== "code") {
      out.push(blocks[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < blocks.length && blocks[j].kind === "code") j++;
    if (j - i === 1) out.push({ kind: "para", items: blocks[i].items });
    else out.push({ kind: "code", items: blocks.slice(i, j).flatMap((b) => b.items) });
    i = j;
  }
  return out;
}

export function groupSentencesIntoBlocks(sentences: string[]): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  let cur: { index: number; seg: string }[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.map((x) => x.seg).join("");
    blocks.push({ kind: classifyReadingBlock(text), items: cur });
    cur = [];
  };
  for (let i = 0; i < sentences.length; i++) {
    const seg = sentences[i];
    if (seg.trim() === "") {
      flush();
      continue;
    }
    cur.push({ index: i, seg });
    if (seg.includes("\n")) flush();
  }
  flush();
  return mergeCodeRuns(blocks);
}

export function cleanBody(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 본문 → 블록 배열(앱과 같은 순번). 가이드의 start 는 이 배열의 인덱스를 가리킨다. */
export function bodyBlocks(body: string): ReadingBlock[] {
  return groupSentencesIntoBlocks(splitSentences(cleanBody(body)));
}

/**
 * LLM 에게 줄 번호 매긴 본문.
 * 블록 전문을 다 넣으면 긴 글에서 입력이 넘치므로 **블록마다 앞 120자**만 보낸다.
 * 단계를 나누는 데에는 각 덩어리가 "무슨 얘기로 시작하는지"면 충분하다.
 */
export function numberedBlocks(blocks: ReadingBlock[], perBlock = 120): string {
  return blocks
    .map((b, i) => {
      const text = b.items.map((x) => x.seg).join("").replace(/\s+/g, " ").trim();
      const mark = b.kind === "heading" ? "[소제목] " : b.kind === "code" ? "[코드] " : "";
      return `[${i}] ${mark}${text.slice(0, perBlock)}`;
    })
    .join("\n");
}
