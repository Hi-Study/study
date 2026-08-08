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
  review_count?: number;
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

// 카테고리 → 좌측 바 색 (design.md)
export const CAT_COLOR: Record<Category, string> = {
  프로덕트: "var(--sky)",
  디자인: "var(--lime)",
  기술: "var(--blue)",
  AI: "var(--orange-hot)",
};

export const CATEGORIES: Category[] = ["프로덕트", "디자인", "기술", "AI"];
