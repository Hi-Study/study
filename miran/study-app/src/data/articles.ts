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
import { topTags } from "@/lib/tags";
import { isMissingColumnError } from "@/lib/pgError";
import { useUid } from "@/auth/AuthProvider";
import type { SummaryMode } from "@/lib/summary";
import type { ArticleRow } from "@/types/tables";
import type { ArticleLevel, Topic } from "@/types/database";

const PAGE_SIZE = 20;

// 아티클 + 출처 블로그(로고칩 표시용) 임베드 결과.
export interface ArticleBlog {
  key: string;
  name: string;
  brand_color: string | null;
  homepage: string | null;
}
export interface ArticleWithBlog extends ArticleRow {
  blog: ArticleBlog | null;
}

const SELECT_WITH_BLOG = "*, blog:blogs(key, name, brand_color, homepage)";

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

// ---- 글 무한 스크롤(홈 최신·피드·검색) ----
// keyset 커서: 최신=(published_at,id) / 인기=(like_count,id).
export interface ArticleCursor {
  published_at: string | null;
  like_count: number;
  id: string;
}
export interface ArticleFeedFilter {
  topic?: Topic;
  topics?: Topic[]; // 카테고리 다중선택
  blogId?: string;
  blogIds?: string[]; // 홈 서비스 다중선택 필터(여러 기업 동시)
  ids?: string[]; // 특정 글 id로 제한(북마크한 글만 보기 등)
  search?: string;
  /** 개발 지식 난도 — "개발 몰라도 읽히는 글만" 을 고를 수 있어야 한다. */
  levels?: ArticleLevel[];
  sort?: "latest" | "popular"; // 기본 latest
}

export async function listArticlesFeed(
  cursor: ArticleCursor | null,
  filter: ArticleFeedFilter = {},
): Promise<{ rows: ArticleWithBlog[]; nextCursor: ArticleCursor | null }> {
  const popular = filter.sort === "popular";

  // withStats=false 는 §21 컬럼(view_count/opinion_count)이 없는 DB용 축소 정렬.
  const build = (withStats: boolean) => {
    let q = supabase.from("articles").select(SELECT_WITH_BLOG).limit(PAGE_SIZE);
    // 인기순: 조회수 → 좋아요 → 인사이트 수 → 최신순(같은 지표면 최근 글 먼저).
    if (popular) {
      if (withStats) q = q.order("view_count", { ascending: false });
      q = q.order("like_count", { ascending: false });
      if (withStats) q = q.order("opinion_count", { ascending: false });
      q = q
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });
    } else {
      q = q.order("published_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
    }

    if (filter.topic) q = q.eq("topic", filter.topic);
    if (filter.topics && filter.topics.length > 0) q = q.in("topic", filter.topics);
    if (filter.blogId) q = q.eq("blog_id", filter.blogId);
    if (filter.blogIds && filter.blogIds.length > 0) q = q.in("blog_id", filter.blogIds);
  if (filter.levels && filter.levels.length > 0) q = q.in("level", filter.levels);
    if (filter.levels && filter.levels.length > 0) q = q.in("level", filter.levels);
    if (filter.ids && filter.ids.length > 0) q = q.in("id", filter.ids);
    const search = filter.search?.replace(/[,(){}%*]/g, " ").trim();
    if (search) {
      q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%,tags.cs.{${search}}`);
    }
    if (cursor) {
      if (popular) {
        q = q.or(
          `like_count.lt.${cursor.like_count},and(like_count.eq.${cursor.like_count},id.lt.${cursor.id})`,
        );
      } else if (cursor.published_at) {
        q = q.or(
          `published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id})`,
        );
      }
    }
    return q;
  };

  let { data, error } = await build(true);
  if (error && popular && isMissingColumnError(error)) ({ data, error } = await build(false));
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  const last = rows[rows.length - 1];
  const hasMore = rows.length === PAGE_SIZE && !!last && (popular || !!last.published_at);
  const nextCursor = hasMore
    ? { published_at: last.published_at, like_count: last.like_count ?? 0, id: last.id }
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

// ---- 피드 필터에 맞는 정확한 글 개수(정렬·커서 무관) ----
export async function countArticlesFeed(filter: ArticleFeedFilter = {}): Promise<number> {
  let q = supabase.from("articles").select("id", { count: "exact", head: true });
  if (filter.topic) q = q.eq("topic", filter.topic);
  if (filter.topics && filter.topics.length > 0) q = q.in("topic", filter.topics);
  if (filter.blogId) q = q.eq("blog_id", filter.blogId);
  if (filter.blogIds && filter.blogIds.length > 0) q = q.in("blog_id", filter.blogIds);
  if (filter.levels && filter.levels.length > 0) q = q.in("level", filter.levels);
  if (filter.ids && filter.ids.length > 0) q = q.in("id", filter.ids);
  const search = filter.search?.replace(/[,(){}%*]/g, " ").trim();
  if (search) {
    q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%,tags.cs.{${search}}`);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export function useArticlesFeedCount(filter: ArticleFeedFilter = {}) {
  return useQuery({
    queryKey: [...qk.articles(), "feed-count", filter] as const,
    queryFn: () => countArticlesFeed(filter),
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
/** 최근 글들의 태그를 집계한 인기 키워드(검색 탭 추천용). */
export async function listPopularTags(limit = 12): Promise<string[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("tags")
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return topTags((data ?? []).map((r) => r.tags), limit);
}

export function usePopularTags() {
  return useQuery({ queryKey: qk.popularTags(), queryFn: () => listPopularTags() });
}

/** 홈 큐레이션 — 인기 글(좋아요 상위). 히어로/인기글 캐러셀용. */
export async function listPopularArticles(limit = 10): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .order("like_count", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function usePopularArticles(limit = 10) {
  return useQuery({
    queryKey: [...qk.articles(), "popular", limit] as const,
    queryFn: () => listPopularArticles(limit),
  });
}

/**
 * 홈 "이번 주 같이 읽는 글" — 최근 7일 안에 **인사이트가 붙은 글**을 묶는다.
 * 주 1회 지정글을 정하지 않는다(운영 부담 + 아무도 안 읽으면 섹션이 죽는다).
 * 이미 여러 명이 읽고 남긴 글을 모아 "같이 읽는 중"이라는 사실 자체를 보여준다.
 * opinion_count 컬럼이 없는 환경에서는 like_count → 최신순으로 자동 폴백.
 */
export async function listWeeklyTogether(limit = 8): Promise<ArticleWithBlog[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const base = () =>
    supabase
      .from("articles")
      .select(SELECT_WITH_BLOG)
      .gte("published_at", since)
      .limit(limit);

  const { data, error } = await base()
    .order("opinion_count", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (!error) return (data ?? []) as unknown as ArticleWithBlog[];
  if (!isMissingColumnError(error)) throw error;

  const { data: fb, error: fbErr } = await base()
    .order("like_count", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (fbErr) throw fbErr;
  return (fb ?? []) as unknown as ArticleWithBlog[];
}

export function useWeeklyTogether(limit = 8) {
  return useQuery({
    queryKey: [...qk.weeklyTogether(), limit] as const,
    queryFn: () => listWeeklyTogether(limit),
    staleTime: 5 * 60_000,
  });
}

/** 홈 큐레이션 — 즐겨찾기(관심) 기업의 새 글, 최신순. 즐겨찾기 없으면 빈 배열. */
export async function listFavoriteBlogArticles(uid: string, limit = 10): Promise<ArticleWithBlog[]> {
  const { data: favs, error: favErr } = await supabase
    .from("user_blog_favorites")
    .select("blog_id")
    .eq("user_id", uid);
  if (favErr) throw favErr;
  const blogIds = (favs ?? []).map((f) => f.blog_id as string);
  if (blogIds.length === 0) return [];
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .in("blog_id", blogIds)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useFavoriteBlogArticles(limit = 10) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.articles(), "fav-blog", uid, limit] as const,
    queryFn: () => listFavoriteBlogArticles(uid, limit),
    enabled: Boolean(uid),
  });
}

/** 홈 큐레이션 — 사용자가 직접 등록한 글(submitted_by 있음), 최신순. */
export async function listDirectArticles(limit = 10): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("submitted_by", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useDirectArticles(limit = 10) {
  return useQuery({
    queryKey: [...qk.articles(), "direct", limit] as const,
    queryFn: () => listDirectArticles(limit),
  });
}

/** 홈 큐레이션 — 추천 글. 내가 읽은 글들의 태그와 겹치는 최신 글(활동 없으면 빈 배열). */
export async function listRecommendedArticles(uid: string, limit = 10): Promise<ArticleWithBlog[]> {
  const tags = await listRecommendedKeywords(uid, 8);
  if (tags.length === 0) return [];
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .overlaps("tags", tags)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useRecommendedArticles(limit = 10) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.articles(), "recommended-articles", uid, limit] as const,
    queryFn: () => listRecommendedArticles(uid, limit),
    enabled: Boolean(uid),
  });
}

/** 홈 큐레이션 — 읽었지만 인사이트를 안 남긴 글(마저 인사이트 유도). 없으면 빈 배열. */
export async function listUnfinishedArticles(uid: string, limit = 10): Promise<ArticleWithBlog[]> {
  const { data: reads, error: rErr } = await supabase
    .from("article_reads")
    .select("article_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(60);
  if (rErr) throw rErr;
  const readIds = (reads ?? []).map((r) => r.article_id as string);
  if (readIds.length === 0) return [];
  const { data: mine, error: oErr } = await supabase
    .from("opinions")
    .select("article_id")
    .eq("author_id", uid);
  if (oErr) throw oErr;
  const opinedIds = new Set((mine ?? []).map((o) => o.article_id as string));
  const targetIds = readIds.filter((id) => !opinedIds.has(id)).slice(0, limit);
  if (targetIds.length === 0) return [];
  const { data, error } = await supabase.from("articles").select(SELECT_WITH_BLOG).in("id", targetIds);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  // 읽은 최신순 유지
  const order = new Map(targetIds.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function useUnfinishedArticles(limit = 10) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.articles(), "unfinished", uid, limit] as const,
    queryFn: () => listUnfinishedArticles(uid, limit),
    enabled: Boolean(uid),
  });
}

/** 홈 대표글 캐러셀 — 이미지 있는 최신 글 N개(좌우 슬라이드). */
export async function listFeaturedArticles(limit = 6): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("og_image", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useFeaturedArticles(limit = 6) {
  return useQuery({
    queryKey: [...qk.articles(), "featured-list", limit] as const,
    queryFn: () => listFeaturedArticles(limit),
  });
}

/** 추천 검색어 — 내가 읽은 글들의 태그를 집계(활동 없으면 빈 배열 → 화면에서 인기로 대체). */
export async function listRecommendedKeywords(uid: string, limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from("article_reads")
    .select("article:articles(tags)")
    .eq("user_id", uid)
    .limit(100);
  if (error) throw error;
  const lists = ((data ?? []) as unknown as { article: { tags: string[] } | null }[]).map(
    (r) => r.article?.tags,
  );
  return topTags(lists, limit);
}

export function useRecommendedKeywords(limit = 10) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.recommendedKeywords(uid),
    queryFn: () => listRecommendedKeywords(uid, limit),
    enabled: Boolean(uid),
  });
}

/**
 * 요약 요청. `jobRole` 을 주면 서버가 3관점의 **세 번째 항목을 그 직무 관점으로** 쓰고
 * ai_summaries 를 직무별 키에 따로 캐시한다(직무마다 요약이 덮어쓰이지 않게).
 */
export async function requestArticleSummary(
  articleId: string,
  mode: SummaryMode,
  jobRole?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { article_id: articleId, mode, job_role: jobRole ?? null },
  });
  if (error) throw error;
  return (data as { summary?: string })?.summary ?? null;
}

export function useRequestArticleSummary(articleId: string, jobRole?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: SummaryMode) => requestArticleSummary(articleId, mode, jobRole),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.article(articleId) }),
  });
}

/**
 * 밑줄 친 문장으로 **질문의 답 초안**을 받아온다(저장하지 않는다).
 *
 * 글 전체를 요약시키지 않는다 — 재료는 내가 직접 밑줄 친 문장뿐이다.
 * 그래야 나오는 초안이 "글의 요약"이 아니라 "내가 이 글에서 본 것"이 되고, 고칠 마음이 생긴다.
 */
export async function draftAnswerFromHighlights(
  question: string,
  source: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { target: "draft", question, source },
  });
  if (error) throw error;
  return ((data as { draft?: string })?.draft ?? "").trim();
}

export function useDraftAnswer() {
  return useMutation({
    mutationFn: (v: { question: string; source: string }) =>
      draftAnswerFromHighlights(v.question, v.source),
  });
}
