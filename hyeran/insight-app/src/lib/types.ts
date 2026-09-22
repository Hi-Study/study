// ── 분류 체계 v4 ──────────────────────────────────────────────
// 분류값은 내부 플래그다. 화면에는 섹션 제목과 카드 헤드라인만 나가고,
// 분류값 자체는 상세의 좌표 칩에만 노출한다.

export type ArticleKind = "개선기" | "소개" | "조직·문화" | "개념 설명" | "소식";

export type ProblemType =
  // 사용자가 겪는 문제
  | "이탈·전환" | "탐색·발견" | "온보딩·첫 경험" | "일관성·디자인 시스템"
  | "성능·속도" | "장애·안정성" | "보안·어뷰징" | "미지원 기능"
  // 만드는 쪽이 겪는 문제
  | "운영·어드민" | "데이터 품질·계측" | "확장·트래픽" | "비용·효율"
  | "레거시 전환" | "개발 생산성" | "사내 지식 접근" | "판단 기준 부재" | "AI 출력 통제";

export type ImpactTarget = "사용자 경험" | "내부 생산성" | "자원·비용" | "비즈니스 성과";
export type ResultCertainty = "수치" | "정성" | "없음";
export type ArticleFlag = "기대와 다른 결과" | "직접 만들기" | "개발 과정에 AI" | "스택 심화";

export type Term = { term: string; description: string };

// 폐기된 축 — 컬럼이 남아 있어 타입만 유지한다
export type Category = "프로덕트" | "디자인" | "개발" | "데이터/AI";
export type Role = "기획" | "디자인" | "개발" | "데이터";

export interface Company {
  id: string;
  slug: string;
  name: string;
  color: string;
  domain: string | null;
}

// 상세 "읽기 전에" 4문항.
// decision 을 별도 필드로 뽑는 것이 이번 변경의 핵심이다 — 해결방법에 묻으면 기술 요약이 된다.
// null 인 문항은 블록째 렌더링하지 않는다.
export interface AiSummary {
  problem: string | null;
  decision: string | null;
  implementation: string | null;
  impact: string | null;
  /** @deprecated v3.2 잔재 — 재판정 전 글에 남아 있다 */
  solution?: string | null;
}

export interface Post {
  id: string;
  company_id: string | null;
  title: string;
  url: string | null;
  tags: string[];
  source: "crawl" | "direct";
  author_id: string | null;

  ai_summary: AiSummary;
  headline: string | null;                  // 카드에서 원제목보다 크게 나가는 우리 제목
  article_kind: ArticleKind | null;         // 글의 성격 (5값)
  problem_type: ProblemType | null;         // 다룬 문제 (17값). 개선기가 아니면 null
  impact_targets: ImpactTarget[];           // 경험 변화 (복수)
  result_certainty: ResultCertainty | null; // 섹션 안 정렬에 쓴다
  flags: ArticleFlag[];                     // 부수 플래그 (복수)
  terms: Term[];                            // 읽기 전 알아두면 좋을 말 (최대 3)

  body: string[];              // 목록 쿼리에는 담기지 않는다 (용량이 커서 상세에서만 읽는다)
  cover_image: string | null;  // body 첫 ::img:: 를 미리 뽑아둔 값
  parsed: boolean;
  published_at: string;

  /** @deprecated 폐기 — 컬럼은 남기되 쓰지 않는다 */
  category?: Category;
  /** @deprecated 폐기 */
  subtitle_phrase?: string | null;
  /** @deprecated 폐기 */
  tech_level?: 1 | 2 | 3 | null;

  company?: Company | null;
  author?: { name: string; initial: string } | null; // 직접 등록 글 작성자
  review_count?: number;
  view_count?: number;
  read_count?: number;
  read?: boolean;
  bookmarked?: boolean;
}

export interface Review {
  id: string;
  post_id: string;
  author_id: string;
  q1: string;
  q2: string;
  q3: string;
  is_draft: boolean;
  created_at: string;
  author?: { name: string; initial: string } | null;
  comment_count?: number;
  like_count?: number;
  liked?: boolean;
  post?: { title: string; company?: Company | null; body?: string[] } | null;
}

export interface Word {
  id: string;
  term: string;
  meaning: string | null;
  post_id: string | null;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  author_id: string;
  title: string;
  body: string;
  media: string[];
  created_at: string;
  author?: { name: string; initial: string } | null;
  like_count?: number;
  liked?: boolean;
  comment_count?: number;
}

export const ARTICLE_KINDS: ArticleKind[] = ["개선기", "소개", "조직·문화", "개념 설명", "소식"];

// 서비스를 쓰는 사람이 겪는 문제
export const USER_PROBLEMS: ProblemType[] = [
  "이탈·전환", "탐색·발견", "온보딩·첫 경험", "일관성·디자인 시스템",
  "성능·속도", "장애·안정성", "보안·어뷰징", "미지원 기능",
];
// 서비스를 만드는 쪽이 겪는 문제
export const MAKER_PROBLEMS: ProblemType[] = [
  "운영·어드민", "데이터 품질·계측", "확장·트래픽", "비용·효율",
  "레거시 전환", "개발 생산성", "사내 지식 접근", "판단 기준 부재", "AI 출력 통제",
];
// 저장은 17개 평면 하나다. 위 구분은 화면에서 읽기 좋으라고 나눈 것일 뿐이다.
export const PROBLEM_TYPES: ProblemType[] = [...USER_PROBLEMS, ...MAKER_PROBLEMS];

export const IMPACT_TARGETS: ImpactTarget[] = ["사용자 경험", "내부 생산성", "자원·비용", "비즈니스 성과"];
export const ARTICLE_FLAGS: ArticleFlag[] = ["기대와 다른 결과", "직접 만들기", "개발 과정에 AI", "스택 심화"];

// 특정 스택을 파고드는 글. 기본으로 감추고, 필요할 때만 켜서 본다
export const STACK_DEEP: ArticleFlag = "스택 심화";
export const isStackDeep = (p: { flags?: ArticleFlag[] }) => !!p.flags?.includes(STACK_DEEP);

// 같은 섹션 안에서 수치 > 정성 > 없음 순으로 올린다
export const certaintyRank = (c?: ResultCertainty | null): number =>
  c === "수치" ? 0 : c === "정성" ? 1 : 2;

// 폐기된 카테고리 색 — 검색 화면이 아직 참조한다
export const CATEGORIES: Category[] = ["프로덕트", "디자인", "개발", "데이터/AI"];
export const CAT_COLOR: Record<Category, string> = {
  프로덕트: "var(--blue)", 디자인: "var(--orange)", 개발: "var(--lime)", "데이터/AI": "var(--sky)",
};

// 카드 썸네일
// 목록 쿼리는 body 를 담지 않으므로 cover_image 컬럼을 먼저 본다.
// body 를 들고 있는 상세 화면에서는 컬럼이 비어 있어도 원문에서 뽑아낸다.
export function coverImage(post: Pick<Post, "body" | "cover_image">): string | null {
  if (post.cover_image) return post.cover_image;
  const img = post.body?.find((s) => s.startsWith("::img::"));
  return img ? img.slice("::img::".length) : null;
}

// 배경색 명도에 따라 가독 텍스트색 (밝은 브랜드색엔 검정, 어두우면 흰색)
export function readableText(hex?: string): string {
  if (!hex) return "#fff";
  const h = hex.replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#141414" : "#fff";
}

// ── 원문은 이렇게 흘러가요 [분류체계 §6-2] ────────────────────
// body 에 저장된 ::h2::/::h3:: 헤딩으로 목차를 만들고, 구간별 글자 수로 읽는 시간을 잡는다.
// AI를 쓰지 않는다 — 헤딩은 이미 원문 구조 그대로다.
const CHARS_PER_MIN = 550; // 한국어 기술 문서 기준 대략치

export type OutlineItem = { title: string; minutes: number };

export function articleOutline(body: string[] | undefined): { items: OutlineItem[]; totalMinutes: number } {
  const blocks = (body ?? []).filter((b) => typeof b === "string" && !b.startsWith("::img::"));
  const items: OutlineItem[] = [];
  let chars = 0;
  let total = 0;

  const flush = () => {
    if (items.length) items[items.length - 1].minutes = Math.max(1, Math.round(chars / CHARS_PER_MIN));
    chars = 0;
  };
  for (const b of blocks) {
    const text = b.replace(/^::[a-z0-9]+::/, "").trim();
    total += text.length;
    if (b.startsWith("::h2::") || b.startsWith("::h3::")) {
      flush();
      if (text) items.push({ title: text, minutes: 1 });
    } else {
      chars += text.length;
    }
  }
  flush();

  // 헤딩이 2개 미만이면 목차라고 부를 만한 구조가 아니다
  return {
    items: items.length >= 2 ? items.slice(0, 8) : [],
    totalMinutes: Math.max(1, Math.round(total / CHARS_PER_MIN)),
  };
}
