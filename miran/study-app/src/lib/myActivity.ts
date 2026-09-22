/**
 * 마이 > 내 활동 — **내가 손댄 글 하나 = 카드 하나.**
 *
 * 예전엔 인사이트·하이라이트·댓글·읽음·단어장이 각자 목록이었다. 테이블을 나눈 방식
 * 그대로였지 사람이 찾는 방식이 아니었다. 한 글에 밑줄 3개 + 인사이트 1개 + 용어 5개를
 * 남기면 세 탭을 돌아다녀야 전체가 보였고, 탭마다 날짜 헤더 규칙도 달랐다.
 *
 * 그래서 축을 **글**로 바꿨다. 위의 칩은 탭이 아니라 **좁히는 필터**다 —
 * 무엇을 남긴 글만 볼지(인사이트·밑줄·댓글·단어), 어떤 주제의 글만 볼지.
 * 필터는 목록을 거르는 동시에 **카드 본문이 무엇을 펼칠지**도 정한다(화면 renderItem).
 *
 * "전체"는 두지 않는다. 읽기만 한 글까지 모두 나오면 목록이 읽은 순서 나열로 돌아가고,
 * 남긴 것이 있는 글이 그 사이에 묻힌다. 읽은 기록은 달력·연속 읽기가 이미 말한다.
 *
 * 순수 함수 — 화면은 결과를 그리기만 한다.
 */
import { collectWordbook, type WordbookPicked, type WordbookTerm } from "@/lib/wordbook";
import { toInsight, type Insight } from "@/lib/insight";
import { serviceKindOf, SERVICE_KIND_ORDER, type ServiceKind } from "@/lib/serviceKind";

/** 활동이 가리키는 글. 어느 목록에서 왔든 이 모양으로만 본다. */
export interface ActivityArticle {
  id: string;
  title: string;
  /** key 는 서비스 종류(커머스·금융…)를 내는 데 쓴다(lib/serviceKind). */
  blog?: { name?: string | null; key?: string | null } | null;
  /** 기준 v1 대분류(한국어 라벨). 분류 밖의 글은 null — 주제 필터에서 빠진다. */
  planner_category?: string | null;
  terms?: unknown;
  reading_guide?: unknown;
}

export interface ActivityInput {
  reads?: (ActivityArticle & { read_at?: string | null })[];
  opinions?: {
    id: string;
    /** jsonb 회고 — 카드에는 **핵심 인사이트(core)** 한 줄만 쓴다. */
    insight?: unknown;
    created_at?: string | null;
    article?: ActivityArticle | null;
  }[];
  highlights?: {
    id: string;
    article_id?: string | null;
    quote?: string | null;
    note?: string | null;
    color?: string | null;
    created_at?: string | null;
    article?: ActivityArticle | null;
  }[];
  comments?: {
    id: string;
    text?: string | null;
    created_at?: string | null;
    opinion?: { id: string; article?: ActivityArticle | null } | null;
  }[];
  words?: (WordbookPicked & { article?: ActivityArticle | null })[];
}

export interface ActivityQuote {
  id: string;
  quote: string;
  note: string;
  color: string;
}

export interface ActivityText {
  id: string;
  text: string;
}

/**
 * 인사이트는 **답만 떼어 오지 않는다.** 답은 질문과 짝일 때만 뜻이 산다
 * ("→ 재시도 정책을 바꿨다"만 있으면 무엇에 답한 말인지 모른다).
 * 화면은 이 전문을 InsightBody 에 그대로 넘겨 질문·답 쌍으로 그린다.
 */
export interface ActivityInsight {
  id: string;
  insight: Insight;
}

export interface MyActivityItem {
  articleId: string;
  title: string;
  blogName: string | null;
  blogKey: string | null;
  category: string | null;
  /** 이 글에 마지막으로 손댄 시각(읽음 포함). 목록은 이 값의 내림차순. */
  latest: string | null;
  read: boolean;
  opinions: ActivityInsight[];
  highlights: ActivityQuote[];
  comments: ActivityText[];
  /** 그 글의 "알아두면 편해요" 용어(+ 내가 담은 단어) — lib/wordbook.ts 와 같은 규칙. */
  terms: WordbookTerm[];
}

export type ActivityFilter = "opinions" | "highlights" | "comments" | "words";

/** 칩 순서 = 내가 들인 품이 큰 순. 아무것도 안 고른 화면은 인사이트부터 보여 준다. */
export const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "opinions", label: "인사이트" },
  { key: "highlights", label: "밑줄" },
  { key: "comments", label: "댓글" },
  { key: "words", label: "단어" },
];

/**
 * 주제 칩 순서 — **기준 v1의 판단 순서**(lib/taste.ts 와 같은 배열).
 * 언어별 정렬에 맡기면 같은 데이터에서 순서가 뒤집혀 "어제와 다른 화면"이 된다.
 */
export const ACTIVITY_CATEGORY_ORDER: string[] = [
  "품질·위험 관리",
  "AI 활용",
  "제품·서비스 기획",
  "데이터·실험",
  "사용자 이해·경험",
  "사업·브랜드",
  "협업·프로세스",
];

const later = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
};

/** 여러 목록을 **글 기준으로** 합친다. 최근에 손댄 글이 위. */
export function collectMyActivity(input: ActivityInput): MyActivityItem[] {
  const items = new Map<string, MyActivityItem>();
  /** 용어를 뽑을 글 — 읽은 글뿐 아니라 밑줄·인사이트만 남긴 글도 넣는다. */
  const articles = new Map<string, ActivityArticle>();

  const touch = (a: ActivityArticle | null | undefined, at: string | null): MyActivityItem | null => {
    if (!a?.id) return null;
    if (!articles.has(a.id)) articles.set(a.id, a);
    const found = items.get(a.id);
    if (found) {
      found.latest = later(found.latest, at);
      // 목록마다 들고 오는 필드가 다르다 — 나중에 온 값이 채워 주면 받는다.
      if (!found.blogName && a.blog?.name) found.blogName = a.blog.name;
      if (!found.blogKey && a.blog?.key) found.blogKey = a.blog.key;
      if (!found.category && a.planner_category) found.category = a.planner_category;
      return found;
    }
    const made: MyActivityItem = {
      articleId: a.id,
      title: a.title,
      blogName: a.blog?.name ?? null,
      blogKey: a.blog?.key ?? null,
      category: a.planner_category ?? null,
      latest: at,
      read: false,
      opinions: [],
      highlights: [],
      comments: [],
      terms: [],
    };
    items.set(a.id, made);
    return made;
  };

  for (const r of input.reads ?? []) {
    const it = touch(r, r.read_at ?? null);
    if (it) it.read = true;
  }
  for (const o of input.opinions ?? []) {
    const it = touch(o.article, o.created_at ?? null);
    const insight = toInsight(o.insight);
    // 핵심 한 줄이 비면 쓰다 만 것이다 — 목록에 올리지 않는다.
    if (it && insight.core.trim()) it.opinions.push({ id: o.id, insight });
  }
  for (const h of input.highlights ?? []) {
    const it = touch(h.article, h.created_at ?? null);
    if (!it) continue;
    it.highlights.push({
      id: h.id,
      quote: (h.quote ?? "").trim(),
      note: (h.note ?? "").trim(),
      color: h.color ?? "yellow",
    });
  }
  for (const m of input.comments ?? []) {
    const it = touch(m.opinion?.article, m.created_at ?? null);
    if (it && (m.text ?? "").trim()) it.comments.push({ id: m.id, text: (m.text ?? "").trim() });
  }
  for (const w of input.words ?? []) {
    touch(w.article, null);
  }

  // 용어는 단어장과 **한 함수**에서 나온다 — 규칙이 두 벌이 되면 곧 어긋난다.
  //   담은 단어는 **원본 행 그대로** 넘긴다 — 화면이 삭제·뜻 재생성을 그 행으로 그린다.
  const picked: WordbookPicked[] = input.words ?? [];
  for (const g of collectWordbook([...articles.values()], picked)) {
    const it = items.get(g.articleId);
    if (it) it.terms = g.items;
  }

  return [...items.values()].sort((a, b) => {
    if (a.latest && b.latest) return a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0;
    if (a.latest) return -1;
    if (b.latest) return 1;
    return 0;
  });
}

/** 이 글이 그 필터에 걸리나. */
export function hasKind(item: MyActivityItem, filter: ActivityFilter): boolean {
  if (filter === "opinions") return item.opinions.length > 0;
  if (filter === "highlights") return item.highlights.length > 0;
  if (filter === "comments") return item.comments.length > 0;
  return item.terms.length > 0;
}

/**
 * 필터의 축 — **기간·주제·기업·서비스 종류.**
 *
 * 주제 하나로만 좁히던 때는 "그 회사 글만" 이나 "이번 달에 남긴 것만" 을 찾을 수가 없었다.
 * 축마다 하나씩만 고른다(다중 선택은 조합이 늘어나 결과가 0건인 이유를 알 수 없게 만든다).
 * null 은 "안 고름".
 */
export interface ActivityFacets {
  category: string | null;
  blog: string | null;
  service: ServiceKind | null;
  period: ActivityPeriod | null;
}

/** 기간 — 오늘을 기준으로 거슬러 센다. */
export type ActivityPeriod = "week" | "month" | "year";

export const PERIOD_LABEL: Record<ActivityPeriod, string> = {
  week: "최근 7일",
  month: "최근 30일",
  year: "올해",
};

export const EMPTY_FACETS: ActivityFacets = {
  category: null,
  blog: null,
  service: null,
  period: null,
};

/** 고른 축의 개수 — 필터 버튼에 "필터 2" 처럼 적는다. */
export function facetCount(f: ActivityFacets): number {
  return [f.category, f.blog, f.service, f.period].filter(Boolean).length;
}

function periodStart(period: ActivityPeriod, now: number): number {
  const d = new Date(now);
  if (period === "week") return now - 7 * 24 * 60 * 60 * 1000;
  if (period === "month") return now - 30 * 24 * 60 * 60 * 1000;
  return new Date(d.getFullYear(), 0, 1).getTime();
}

export function filterActivity(
  items: MyActivityItem[],
  filter: ActivityFilter,
  facets: ActivityFacets = EMPTY_FACETS,
  now: number = Date.now(),
): MyActivityItem[] {
  const from = facets.period ? periodStart(facets.period, now) : null;
  return items.filter((it) => {
    if (!hasKind(it, filter)) return false;
    if (facets.category && it.category !== facets.category) return false;
    if (facets.blog && it.blogName !== facets.blog) return false;
    if (facets.service && serviceKindOf(it.blogKey ?? "") !== facets.service) return false;
    if (from !== null) {
      const at = it.latest ? Date.parse(it.latest) : NaN;
      if (Number.isNaN(at) || at < from) return false;
    }
    return true;
  });
}

/** 칩에 띄울 **글 수**(활동 개수가 아니다 — 목록의 줄 수와 같아야 한다). */
export function activityCounts(items: MyActivityItem[]): Record<ActivityFilter, number> {
  const out: Record<ActivityFilter, number> = {
    opinions: 0,
    highlights: 0,
    comments: 0,
    words: 0,
  };
  for (const it of items) {
    if (it.opinions.length > 0) out.opinions += 1;
    if (it.highlights.length > 0) out.highlights += 1;
    if (it.comments.length > 0) out.comments += 1;
    if (it.terms.length > 0) out.words += 1;
  }
  return out;
}

/** 내 활동에 실제로 있는 기업 — 많이 남긴 순. */
export function activityBlogs(items: MyActivityItem[]): string[] {
  const n = new Map<string, number>();
  for (const it of items) if (it.blogName) n.set(it.blogName, (n.get(it.blogName) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

/** 내 활동에 실제로 있는 서비스 종류 — 표 순서대로. */
export function activityServices(items: MyActivityItem[]): ServiceKind[] {
  const seen = new Set<ServiceKind>();
  for (const it of items) if (it.blogKey) seen.add(serviceKindOf(it.blogKey));
  return SERVICE_KIND_ORDER.filter((k) => seen.has(k));
}

/**
 * 고를 수 있는 주제 — **내 활동 전체**에서 뽑는다(지금 고른 종류 안에서가 아니라).
 *
 * 예전엔 고른 종류 안에 있는 주제만 냈는데, 그러면 밑줄을 보다가 주제를 바꾸면 목록이
 * 통째로 사라지는 대신 **고를 수 있는 주제 자체가 줄어** 무엇이 있는지도 알 수 없었다.
 * 지금은 다 내고, 결과가 없으면 "없다"고 말한다(0건도 정보다).
 */
export function activityCategories(items: MyActivityItem[]): string[] {
  const seen = new Set<string>();
  for (const it of items) if (it.category) seen.add(it.category);
  const rank = (k: string) => {
    const i = ACTIVITY_CATEGORY_ORDER.indexOf(k);
    return i < 0 ? ACTIVITY_CATEGORY_ORDER.length : i;
  };
  return [...seen].sort((a, b) => rank(a) - rank(b));
}

/**
 * 고른 필터에 글이 없으면 **있는 칩으로 옮긴다** — 빈 화면을 첫 인상으로 주지 않는다.
 * 모두 비어 있으면 고른 값을 그대로 둔다(그 필터의 빈 상태 문구가 나간다).
 */
export function resolveFilter(
  filter: ActivityFilter,
  counts: Record<ActivityFilter, number>,
): ActivityFilter {
  if (counts[filter] > 0) return filter;
  return ACTIVITY_FILTERS.find((f) => counts[f.key] > 0)?.key ?? filter;
}

/** 카드 밑줄 한 줄 — "인사이트 1 · 밑줄 3 · 용어 5". 남긴 게 없으면 "읽음". */
export function activitySummary(item: MyActivityItem): string {
  const parts: string[] = [];
  if (item.opinions.length > 0) parts.push(`인사이트 ${item.opinions.length}`);
  if (item.highlights.length > 0) parts.push(`밑줄 ${item.highlights.length}`);
  if (item.comments.length > 0) parts.push(`댓글 ${item.comments.length}`);
  if (item.terms.length > 0) parts.push(`용어 ${item.terms.length}`);
  if (parts.length === 0) return item.read ? "읽음" : "";
  return parts.join(" · ");
}
