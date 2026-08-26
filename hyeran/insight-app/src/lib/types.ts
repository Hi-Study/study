export type Category =
  | "프로덕트" | "UIUX" | "디자인" | "AI" | "비즈니스" | "데이터 분석"
  | "프론트엔드" | "백엔드" | "데이터베이스" | "보안" | "모바일";

export interface Company {
  id: string;
  slug: string;
  name: string;
  color: string;
  domain: string | null;
}

export interface AiSummary {
  problem: string;
  solution: string;
  learning: string;
}

export interface Post {
  id: string;
  company_id: string | null;
  title: string;
  url: string | null;
  category: Category;
  tags: string[];
  source: "crawl" | "direct";
  author_id: string | null;
  ai_summary: AiSummary;
  body: string[];
  parsed: boolean;
  published_at: string;
  company?: Company | null;
  author?: { name: string; initial: string } | null; // 직접 등록 글 작성자
  review_count?: number;
  view_count?: number; // 글별 총 조회수 (posts.view_count) — 카드 대표 지표 [v3.0]
  read_count?: number; // 글별 읽음(완독) 수 — 내부 지표(⑤ 상태·통계)
  read?: boolean; // 내가 다 읽은 글 (카드 배지용)
  bookmarked?: boolean; // 내가 북마크한 글 (카드 토글 초기값)
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

// 단어장 [v3.0]
export interface Word {
  id: string;
  term: string;
  meaning: string | null;
  post_id: string | null;
  created_at: string;
}

// 커뮤니티 자유글 [v3.0]
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

export const CATEGORIES: Category[] = [
  "프로덕트", "UIUX", "디자인", "AI", "비즈니스", "데이터 분석",
  "프론트엔드", "백엔드", "데이터베이스", "보안", "모바일",
];

// 11개 카테고리 → 4계열 그룹 (색은 4계열만)
type CatGroup = "product" | "design" | "dev" | "data";
const CAT_GROUP: Record<Category, CatGroup> = {
  프로덕트: "product", 비즈니스: "product",
  UIUX: "design", 디자인: "design",
  프론트엔드: "dev", 백엔드: "dev", 데이터베이스: "dev", 보안: "dev", 모바일: "dev",
  AI: "data", "데이터 분석": "data",
};
// 카드 좌측 3px 바 색 (4계열)
const GROUP_BAR: Record<CatGroup, string> = { product: "var(--blue)", design: "var(--orange)", dev: "var(--lime)", data: "var(--sky)" };
// 카테고리 pill 글자색 (4계열, 대비 확보)
const GROUP_FG: Record<CatGroup, string> = { product: "#2563EB", design: "#C2410C", dev: "#3F7A00", data: "#0E7490" };

export const catGroup = (c: Category): CatGroup => CAT_GROUP[c] ?? "dev";
export const CAT_COLOR: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c, GROUP_BAR[catGroup(c)]]),
) as Record<Category, string>;
export const catFg = (c: Category): string => GROUP_FG[catGroup(c)];

// 본문(body[])의 첫 이미지 마커(::img::URL)를 커버 이미지로 추출
export function coverImage(post: Post): string | null {
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
