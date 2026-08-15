export type Category = "프로덕트" | "디자인" | "기술" | "AI";

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
  read_count?: number; // 글별 읽음(완독) 수 — 뷰수 대체 (통일 카드 메타)
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
  post?: { title: string; company?: Company | null } | null;
}

// 카테고리 → 액센트 색 (DESIGN.md, aisbrow 팔레트와 동일)
export const CAT_COLOR: Record<Category, string> = {
  프로덕트: "var(--cat-product)",
  디자인: "var(--cat-design)",
  기술: "var(--cat-tech)",
  AI: "var(--cat-ai)",
};

export const CATEGORIES: Category[] = ["프로덕트", "디자인", "기술", "AI"];

// 카테고리 → 영문 라벨 (혼용: 카테고리·로고는 영문)
export const CAT_EN: Record<Category, string> = {
  프로덕트: "Product",
  디자인: "Design",
  기술: "Tech",
  AI: "AI",
};

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
