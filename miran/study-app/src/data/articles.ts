// distill 아티클(자동 수집 글) 조회 — 홈(서비스별 캐러셀·최신 피드)·피드(주제별)·글 상세.
// 규약: 화면은 supabase 직접 호출 금지, 이 계층의 raw 함수/use* 훅만 사용.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import type { SummaryMode } from "@/lib/summary";
import type { ArticleRow } from "@/types/tables";
import type { Topic } from "@/types/database";

const PAGE_SIZE = 20;

// 아티클 + 출처 블로그(로고칩 표시용) 임베드 결과.
export interface ArticleBlog {
  key: string;
  name: string;
  brand_color: string | null;
}
export interface ArticleWithBlog extends ArticleRow {
  blog: ArticleBlog | null;
}

const SELECT_WITH_BLOG = "*, blog:blogs(key, name, brand_color)";

// ---- 단건 상세 ----
export async function getArticleDetail(articleId: string): Promise<ArticleWithBlog> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .eq("id", articleId)
    .single();
  if (error) throw error;
  return data as unknown as ArticleWithBlog;
}

export function useArticle(articleId: string) {
  return useQuery({
    queryKey: qk.article(articleId),
    queryFn: () => getArticleDetail(articleId),
    enabled: Boolean(articleId),
  });
}

// ---- 블로그별 최신 N개(홈 캐러셀) ----
export async function listArticlesByBlog(
  blogId: string,
  limit = 10,
): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .eq("blog_id", blogId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useArticlesByBlog(blogId: string, limit = 10) {
  return useQuery({
    queryKey: [...qk.articles(), "blog-id", blogId, limit] as const,
    queryFn: () => listArticlesByBlog(blogId, limit),
    enabled: Boolean(blogId),
  });
}

// ---- 주제별 최신 N개(홈 주제 하이라이트) ----
export async function listArticlesByTopic(
  topic: Topic,
  limit = 10,
): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .eq("topic", topic)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useArticlesByTopic(topic: Topic, limit = 10) {
  return useQuery({
    queryKey: [...qk.articlesByTopic(topic), limit] as const,
    queryFn: () => listArticlesByTopic(topic, limit),
    enabled: Boolean(topic),
  });
}

// ---- 최신 글 무한 스크롤(홈 최신·피드) ----
// keyset 커서: (published_at, id). published_at 없는 글은 뒤로(nullsFirst:false).
export interface ArticleCursor {
  published_at: string;
  id: string;
}
export interface ArticleFeedFilter {
  topic?: Topic;
  blogId?: string;
  search?: string;
}

export async function listArticlesFeed(
  cursor: ArticleCursor | null,
  filter: ArticleFeedFilter = {},
): Promise<{ rows: ArticleWithBlog[]; nextCursor: ArticleCursor | null }> {
  let q = supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (filter.topic) q = q.eq("topic", filter.topic);
  if (filter.blogId) q = q.eq("blog_id", filter.blogId);
  const search = filter.search?.replace(/[,(){}%*]/g, " ").trim();
  if (search) {
    q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%,tags.cs.{${search}}`);
  }
  if (cursor) {
    q = q.or(
      `published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === PAGE_SIZE && last?.published_at
      ? { published_at: last.published_at, id: last.id }
      : null;
  return { rows, nextCursor };
}

export function useArticlesFeed(filter: ArticleFeedFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.articles(), "feed", filter] as const,
    queryFn: ({ pageParam }) =>
      listArticlesFeed(pageParam as ArticleCursor | null, filter),
    initialPageParam: null as ArticleCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

// ---- 피처드(홈 상단 대표 글) — 대표 이미지 있는 최신 글 1개 ----
export async function getFeaturedArticle(): Promise<ArticleWithBlog | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("og_image", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  return rows[0] ?? null;
}

export function useFeaturedArticle() {
  return useQuery({
    queryKey: [...qk.articles(), "featured"] as const,
    queryFn: getFeaturedArticle,
  });
}

// ---- 블로그가 가진 주제 목록(서비스 상세의 카테고리 칩용) ----
export async function listBlogTopics(blogId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("topic")
    .eq("blog_id", blogId)
    .not("topic", "is", null)
    .limit(1000);
  if (error) throw error;
  const seen = new Set<Topic>();
  for (const r of (data ?? []) as { topic: Topic | null }[]) {
    if (r.topic) seen.add(r.topic);
  }
  return [...seen];
}

export function useBlogTopics(blogId: string) {
  return useQuery({
    queryKey: [...qk.articles(), "blog-topics", blogId] as const,
    queryFn: () => listBlogTopics(blogId),
    enabled: Boolean(blogId),
  });
}

// ---- AI 요약(모드별) — summarize 엣지 함수 호출 → articles.ai_summaries[mode] 캐시 ----
export async function requestArticleSummary(
  articleId: string,
  mode: SummaryMode,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { article_id: articleId, mode },
  });
  if (error) throw error;
  return (data as { summary?: string })?.summary ?? null;
}

export function useRequestArticleSummary(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: SummaryMode) => requestArticleSummary(articleId, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.article(articleId) }),
  });
}
