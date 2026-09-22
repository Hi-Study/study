/**
 * 내 취향 분석 — 읽은 글의 **대분류·태그 분포**로 "나는 무엇을 읽는 사람인가"를 말해 준다.
 *
 * 마이 프로필의 부제가 예전엔 "읽고 생각을 남기는 중" 같은 고정 문구였다. 아무 정보가 없다 —
 * 들어온 사람이 자기 기록을 보러 온 자리인데, 화면이 자기에 대해 아무 말도 안 했다.
 *
 * 표본이 적을 때 단정하지 않는다. 3편 읽고 "AI 활용을 주로 읽어요"라고 하면 그건 분석이 아니라
 * 우연이다. 그래서 `TASTE_MIN` 편 아래에서는 "몇 편부터 보인다"고만 말한다.
 *
 * 분류되지 않은 글(기준 v1 대상 밖)은 계산에서 빼야 한다 — 안 그러면 분모만 커져서
 * 비율이 전부 낮게 나온다.
 */
import type { PlannerCategory, PlannerTags } from "@/types/database";

/** 취향을 말하기 시작하는 최소 편수. */
export const TASTE_MIN = 5;

export interface TasteInput {
  planner_category?: PlannerCategory | null;
  planner_tags?: PlannerTags | null;
  /** 어느 기업 글을 읽었나 — 취향의 두 번째 축. */
  blog?: { name?: string | null } | null;
}

export interface TasteResult {
  /** 분류가 있는 글 중 읽은 편수(= 분모). */
  total: number;
  /** 많이 읽은 대분류 순. share 는 0~1. */
  categories: { label: PlannerCategory; count: number; share: number }[];
  /**
   * 많이 읽은 기업 순. share 는 0~1.
   *
   * ⚠️ 분모가 대분류와 다르다 — **읽은 글 전체**가 분모다. 분류되지 않은 글도 어느 기업
   * 글인지는 알기 때문이다. 대분류는 분류된 글만 셀 수 있어서 분모가 더 작다.
   */
  blogs: { label: string; count: number; share: number }[];
  /** 기업 분포의 분모(= 읽은 글 전체). */
  totalReads: number;
  /** 자주 걸린 태그(목적·방법·제품 상황). 기술 태그는 제외 — 기획자 취향이 아니다. */
  tags: { label: string; count: number }[];
  /** 취향을 말할 만큼 읽었나. */
  enough: boolean;
}

/**
 * 동점일 때의 순서 — **기준 v1의 판단 순서**를 그대로 쓴다.
 * 언어별 정렬(localeCompare)에 맡기면 같은 데이터에서도 순서가 뒤집혀
 * "어제는 AI 활용이 1등이었는데 오늘은 사용자 이해·경험"처럼 보인다.
 */
const CATEGORY_ORDER: string[] = [
  "품질·위험 관리",
  "AI 활용",
  "제품·서비스 기획",
  "데이터·실험",
  "사용자 이해·경험",
  "사업·브랜드",
  "협업·프로세스",
];

function topOf(map: Map<string, number>, order?: string[]): [string, number][] {
  const rank = (k: string) => {
    const i = order?.indexOf(k) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...map.entries()].sort(
    (a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]),
  );
}

export function analyzeTaste(reads: TasteInput[]): TasteResult {
  const blogs = new Map<string, number>();
  const cats = new Map<string, number>();
  const tags = new Map<string, number>();
  /** 태그 종류 순위 — 동점일 때 **목적 → 방법 → 제품 상황** 순으로 말한다. */
  const tagKind = new Map<string, number>();
  let total = 0;

  for (const r of reads) {
    // 기업은 분류와 무관하게 센다 — 분류 밖의 글도 출처는 분명하다.
    const blog = (r.blog?.name ?? "").trim();
    if (blog) blogs.set(blog, (blogs.get(blog) ?? 0) + 1);

    const cat = r.planner_category;
    if (!cat) continue; // 분류 밖의 글은 분모에서도 뺀다
    total += 1;
    cats.set(cat, (cats.get(cat) ?? 0) + 1);
    const t = r.planner_tags ?? {};
    const groups: [number, (string | undefined)[]][] = [
      [0, [t.purpose]],
      [1, t.methods ?? []],
      [2, t.contexts ?? []],
    ];
    for (const [kind, labels] of groups) {
      for (const label of labels) {
        const v = (label ?? "").trim();
        // "사내 업무"는 거의 모든 AI 글에 붙어서 취향을 구분하지 못한다(실측 109건).
        if (!v || v === "사내 업무") continue;
        tags.set(v, (tags.get(v) ?? 0) + 1);
        if (!tagKind.has(v)) tagKind.set(v, kind);
      }
    }
  }

  return {
    total,
    categories: topOf(cats, CATEGORY_ORDER).map(([label, count]) => ({
      label: label as PlannerCategory,
      count,
      share: total > 0 ? count / total : 0,
    })),
    blogs: topOf(blogs).map(([label, count]) => ({
      label,
      count,
      share: reads.length > 0 ? count / reads.length : 0,
    })),
    totalReads: reads.length,
    // 한 번만 걸린 태그는 취향이 아니라 우연이다.
    tags: [...tags.entries()]
      .filter(([, n]) => n >= 2)
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          (tagKind.get(a[0]) ?? 9) - (tagKind.get(b[0]) ?? 9) ||
          a[0].localeCompare(b[0]),
      )
      .map(([label, count]) => ({ label, count })),
    enough: total >= TASTE_MIN,
  };
}

export interface NarrativeInput {
  /** 부르는 이름(님 붙여서 쓴다). */
  name: string;
  taste: TasteResult;
  /** 이번 달 읽은 편수 / 남긴 인사이트 수(my_reading_stats). 0 이면 문장에서 뺀다. */
  monthReads?: number;
  monthOpinions?: number;
}

/**
 * 취향 카드의 **머리 문장.**
 *
 * 카드의 본체는 분포 **막대**(대분류 · 기업)다. 문장은 그 위에 한 줄로 얹혀
 * "지금 어디쯤인지"만 말한다 — 막대는 비율을 보여주지만 *이번 달에 얼마나 읽었는지*는
 * 말해 주지 못하고, 표본이 적을 때 "아직 단정하지 않는다"는 것도 문장만 할 수 있다.
 *
 * 0 은 문장에 넣지 않는다("인사이트 0개를 남겼어요"는 벌칙이 된다).
 */
export function tasteNarrative({
  name,
  taste,
  monthReads = 0,
  monthOpinions = 0,
}: NarrativeInput): string {
  const who = `${name}님`;
  if (!taste.enough) {
    if (taste.total === 0) return `${who}, 첫 글을 읽으면 관심 주제를 찾아드려요.`;
    const left = TASTE_MIN - taste.total;
    return `${who}은 지금 취향을 만드는 중이에요. ${left}편 더 읽으면 관심 주제를 알려드릴게요.`;
  }

  const [first, second] = taste.categories;
  const head =
    second && first.share < 0.5
      ? `${who}은 ${first.label}과 ${second.label} 글을 비슷하게 봐요.`
      : `${who}은 ${first.label} 글에 관심이 많아요.`;

  const month =
    monthReads > 0
      ? monthOpinions > 0
        ? ` 이번 달엔 ${monthReads}편을 읽고 인사이트 ${monthOpinions}개를 남겼어요.`
        : ` 이번 달엔 ${monthReads}편을 읽었어요.`
      : "";

  const [t1, t2] = taste.tags;
  const tags = t2
    ? ` 그중에서도 ${t1.label}·${t2.label} 이야기를 자주 골랐어요.`
    : t1
      ? ` 특히 ${t1.label} 이야기를 자주 골랐어요.`
      : "";

  return `${head}${month}${tags}`;
}

/** 프로필 부제 한 줄. 표본이 적으면 단정하지 않는다. */
export function tasteLine(t: TasteResult): string {
  if (!t.enough) {
    const left = TASTE_MIN - t.total;
    return t.total === 0
      ? "글을 읽으면 취향을 알려드려요"
      : `읽은 글 ${t.total}편 · ${left}편 더 읽으면 취향이 보여요`;
  }
  const [first, second] = t.categories;
  // 1등이 절반을 넘으면 한 갈래로 말한다. 그 아래면 두 갈래를 나란히 둔다.
  if (!second || first.share >= 0.5) return `${first.label} 글을 주로 읽어요`;
  return `${first.label} · ${second.label} 글을 많이 읽어요`;
}
