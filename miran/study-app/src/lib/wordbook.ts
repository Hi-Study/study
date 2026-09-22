/**
 * 단어장 — **내가 읽은 글의 "알아두면 편해요" 용어를 글별로 모아 둔 것.**
 *
 * 예전 단어장은 "문장을 길게 눌러 내가 담은 단어" 목록이었다. 지금은 글 상세가 용어를
 * 미리 뽑아 밑줄까지 그어 주므로(§26 terms) 담는 행동이 거의 일어나지 않는다 — 실제로 담긴
 * 단어는 5개뿐이었고, 단어장은 빈 채로 남았다. 그래서 출처를 **읽은 글의 용어**로 바꿨다.
 * 읽기만 해도 단어장이 쌓인다.
 *
 * 묶는 단위는 **글**이다. 단어만 쭉 늘어놓으면 "이 말을 어디서 봤더라"가 사라진다 —
 * 용어는 그 글의 맥락 안에서만 뜻이 산다. 카드를 누르면 그 글로 돌아간다.
 *
 * 순수 함수 — 화면은 결과를 그리기만 한다.
 */
import { toTerms } from "@/lib/terms";

/** 읽은 글 — `terms`(영역 있음)와 `reading_guide.terms`(영역 없음)를 모두 본다. */
export interface WordbookRead {
  id: string;
  title: string;
  terms?: unknown;
  reading_guide?: unknown;
}

/** 내가 직접 담은 단어(user_words). 삭제·뜻 다시 만들기를 위해 원본을 들고 다닌다. */
export interface WordbookPicked {
  id: string;
  term: string;
  definition?: string | null;
  domain?: string | null;
  article_id?: string | null;
}

export interface WordbookTerm {
  term: string;
  plain: string;
  /** 'dev' | 'design' | … | '' (영역 미상) */
  domain: string;
  /** 있으면 내가 담은 단어다 — 화면은 WordCard(삭제·뜻 재생성)로 그린다. */
  picked?: WordbookPicked;
}

export interface WordbookArticle {
  /** 직접 담았는데 읽은 글에 없는 단어들을 모으는 묶음은 빈 문자열. */
  articleId: string;
  title: string;
  items: WordbookTerm[];
}

/** 읽은 글에 속하지 않은 '직접 담은 단어' 묶음의 제목. */
export const PICKED_GROUP_TITLE = "직접 담은 단어";

const norm = (s: string) => s.trim().toLowerCase();

/** `reading_guide.terms` — {term, plain} 만 있고 영역이 없다. */
function guideTerms(raw: unknown): { term: string; plain: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { terms?: unknown }).terms;
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => {
      const o = (t ?? {}) as { term?: unknown; plain?: unknown };
      return {
        term: typeof o.term === "string" ? o.term.trim() : "",
        plain: typeof o.plain === "string" ? o.plain.trim() : "",
      };
    })
    .filter((t) => t.term && t.plain);
}

/**
 * 읽은 순서를 그대로 유지한다(호출부가 최근 읽은 순으로 넘긴다).
 * 용어가 하나도 없는 글은 넣지 않는다 — 제목만 있는 빈 카드가 목록을 채운다.
 */
export function collectWordbook(
  reads: WordbookRead[],
  picked: WordbookPicked[] = [],
): WordbookArticle[] {
  const pickedByArticle = new Map<string, WordbookPicked[]>();
  for (const p of picked) {
    const key = p.article_id ?? "";
    pickedByArticle.set(key, [...(pickedByArticle.get(key) ?? []), p]);
  }
  const usedPicked = new Set<string>();

  const groups: WordbookArticle[] = [];
  for (const a of reads) {
    const seen = new Map<string, WordbookTerm>();
    const add = (term: string, plain: string, domain: string) => {
      const key = norm(term);
      if (!key || !plain) return;
      const found = seen.get(key);
      // 같은 글 안에서 중복되면 영역 있는 쪽을 남긴다(가이드 용어엔 영역이 없다).
      if (found) {
        if (!found.domain && domain) found.domain = domain;
        return;
      }
      seen.set(key, { term, plain, domain });
    };
    for (const t of toTerms(a.terms)) add(t.term, t.plain, t.domain ?? "");
    for (const t of guideTerms(a.reading_guide)) add(t.term, t.plain, "");

    // 이 글에서 직접 담은 단어 — 같은 말이면 그 줄에 원본을 붙이고, 없으면 줄을 새로 만든다.
    for (const p of pickedByArticle.get(a.id) ?? []) {
      const key = norm(p.term);
      if (!key) continue;
      usedPicked.add(p.id);
      const found = seen.get(key);
      if (found) {
        found.picked = p;
        if (!found.domain && p.domain) found.domain = p.domain;
        continue;
      }
      seen.set(key, {
        term: p.term,
        plain: (p.definition ?? "").trim(),
        domain: p.domain ?? "",
        picked: p,
      });
    }

    if (seen.size === 0) continue;
    groups.push({ articleId: a.id, title: a.title, items: [...seen.values()] });
  }

  // 읽은 글에 속하지 않은(또는 글이 목록에 없는) 담은 단어는 맨 아래 한 묶음으로.
  const orphans = picked.filter((p) => !usedPicked.has(p.id));
  if (orphans.length > 0) {
    groups.push({
      articleId: "",
      title: PICKED_GROUP_TITLE,
      items: orphans.map((p) => ({
        term: p.term,
        plain: (p.definition ?? "").trim(),
        domain: p.domain ?? "",
        picked: p,
      })),
    });
  }

  return groups;
}

/** 단어장에 담긴 전체 용어 수 — 빈 상태 판단에 쓴다. */
export function wordbookCount(groups: WordbookArticle[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
