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
  /** 아이프레임 안에 띄울 수 있나(§39). null = 아직 확인 안 함 → 새 탭으로 보낸다. */
  frameable: boolean | null;
}
export interface ArticleWithBlog extends ArticleRow {
  blog: ArticleBlog | null;
}

/**
 * **제외 판정된 글은 목록에 넣지 않는다.**
 *
 * `planner_included = false` 는 분류가 "서비스에 넣지 않는다"고 판정한 글이다
 * (행사 안내·후기, 채용 공고, 구현 가이드처럼 제품 판단과 연결되지 않는 글).
 * 그런데 목록 쿼리가 이 컬럼을 보지 않아서 **제외해도 그대로 보였다** —
 * 판정이 아무 일도 하지 않았다(실측: 20건을 뺐는데 피드에 전부 남아 있었다).
 *
 * ⚠️ `is false` 만 뺀다. `null`(아직 판정 안 함)은 **보여준다** —
 *    536건이 미판정인데 그걸 숨기면 서비스가 통째로 비어 버린다.
 * ⚠️ 글 상세에는 걸지 않는다 — 링크를 직접 받은 사람은 볼 수 있어야 한다.
 */
// frameable 을 같이 받는다 — "원문 보러가기"를 앱 안에서 열지 새 탭으로 열지 여기서 갈린다(§39).
const SELECT_WITH_BLOG = "*, blog:blogs(key, name, brand_color, homepage, frameable)";

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
    .not("planner_included", "is", false)
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
    .not("planner_included", "is", false)
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
  /** 대표 태그(목적) — "전환", "이탈" 처럼 글이 이루려던 것 하나. */
  purpose?: string;
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
    let q = supabase
      .from("articles")
      .select(SELECT_WITH_BLOG)
      .not("planner_included", "is", false)
      .limit(PAGE_SIZE);
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
    // 대표 태그는 `planner_tags.purpose` 에 있다(jsonb 안).
    // ⚠️ 한때 `purpose_tag` 라는 **별도 컬럼**을 만들어 같은 값을 두 벌로 들고 있었다.
    //    그 컬럼이 사라지면서 이 쿼리가 400 을 내고 있었다 — 정본은 planner_tags 하나다.
    if (filter.purpose) q = q.eq("planner_tags->>purpose", filter.purpose);
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
  // 개수도 같은 잣대로 센다 — 목록과 숫자가 어긋나면 어느 쪽을 믿을지 알 수 없다.
  let q = supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .not("planner_included", "is", false);
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
    .not("planner_included", "is", false)
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
/**
 * 자주 보이는 **대표 태그**(목적) — 홈의 "이런 걸 하려던 글이에요".
 *
 * 대표 태그만 센다. 세부 태그(방법·상황·기술)까지 섞으면 "A/B 테스트"와 "전환"이 한 줄에
 * 나란히 서서 층위가 뭉갠다. 세부는 필터·검색에서 쓴다(기준 v1 4단계).
 */
export async function listPopularTags(limit = 12): Promise<string[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("planner_tags")
    .not("planner_tags->>purpose", "is", null)
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as { planner_tags: { purpose?: string } | null }[];
  return topTags(
    rows.map((r) => (r.planner_tags?.purpose ? [r.planner_tags.purpose] : [])),
    limit,
  );
}

export function usePopularTags() {
  return useQuery({ queryKey: qk.popularTags(), queryFn: () => listPopularTags() });
}

/** 홈 큐레이션 — 인기 글(좋아요 상위). 히어로/인기글 캐러셀용. */
export async function listPopularArticles(limit = 10): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
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
      .not("planner_included", "is", false)
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
    .not("planner_included", "is", false)
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
    .not("planner_included", "is", false)
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

/**
 * 같은 시리즈의 글들 — **여러 편으로 나뉜 이야기를 한 줄로 잇는다**(§40).
 *
 * 시리즈 중간편은 그 편만 열면 무슨 이야기인지 알 수 없다. "왜 만들었나"는 1편에만 있고
 * 중간편은 구현만 다루는 일이 흔하다. 그렇다고 중간편을 빼면 이야기가 끊기니,
 * **빼지 않고 상세에서 같이 보여준다.**
 *
 * ⚠️ `blog_id` 까지 함께 건다. 제목이 겹치는 **남의 블로그 글**과 섞이면 안 된다.
 * ⚠️ 제외 판정된 편도 가져온다 — 시리즈는 통째로 보여야 이야기가 이어진다.
 *    (목록·피드에서는 여전히 빠진다. 여기서만 예외다.)
 */
export async function listSeriesArticles(
  blogId: string,
  seriesKey: string,
): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .eq("blog_id", blogId)
    .eq("series_key", seriesKey)
    .order("series_no", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithBlog[];
}

export function useSeriesArticles(blogId?: string | null, seriesKey?: string | null) {
  return useQuery({
    queryKey: [...qk.articles(), "series", blogId, seriesKey] as const,
    queryFn: () => listSeriesArticles(blogId as string, seriesKey as string),
    enabled: !!blogId && !!seriesKey,
    staleTime: 5 * 60 * 1000,
  });
}


/** 홈 큐레이션 — 추천 글. 내가 읽은 글들의 태그와 겹치는 최신 글(활동 없으면 빈 배열). */
export async function listRecommendedArticles(uid: string, limit = 10): Promise<ArticleWithBlog[]> {
  const tags = await listRecommendedKeywords(uid, 8);
  if (tags.length === 0) return [];
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
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

/**
 * 홈 맨 위 "오늘은 이 글 어때요?" — **하루에 한 편만** 고른다.
 *
 * 고르는 피로를 없애는 게 목적이라, 새로고침할 때마다 바뀌면 안 된다.
 * 날짜를 씨앗으로 최근 글 중 하나를 집는다 — 같은 날엔 같은 글, 자정이 지나면 다음 글.
 * (서버에 '오늘의 글' 테이블을 두지 않는 이유: 매일 누가 고르는 운영이 생긴다.)
 */
export async function listTodayArticle(): Promise<ArticleWithBlog | null> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
    // 요약이 없는 글은 오늘의 글로 못 쓴다 — 한 줄 소개 없이 큰 카드를 세울 수 없다.
    .not("topic", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  if (rows.length === 0) return null;
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return rows[seed % rows.length];
}

export function useTodayArticle() {
  return useQuery({ queryKey: [...qk.articles(), "today"] as const, queryFn: listTodayArticle });
}

/** 결과를 수치로 말한 문장인가 — "전환율이 12% 올랐다", "3초 → 0.8초". */
const NUMBER_RE = /[0-9][0-9.,]*\s*(%|초|분|시간|배|만|억|천|명|건|ms|p)/;

/**
 * "숫자로 답한 글" — 결과를 **수치로** 말한 글만.
 *
 * 기획자가 회의에서 인용할 수 있는 글은 "좋아졌다"가 아니라 "12% 올랐다"고 말한 글이다.
 * 대분류 `data_exp`(데이터·실험)만으로는 부족하다 — 실험 얘기지만 결과가 없는 글이 섞인다.
 * 그래서 대분류가 아니라 **요약·핵심 줄에 숫자가 있는지**로 고른다.
 */
export async function listEvidenceArticles(limit = 8): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
    .not("reading_guide", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  return rows
    .filter((a) => {
      const g = a.reading_guide;
      // 리드(무슨 일/왜/그래서)와 소제목 답 문단을 다 훑는다 — 수치는 보통 "그래서"에 있다.
      const text = [
        g?.summary ?? "",
        g?.lead?.what ?? "",
        g?.lead?.why ?? "",
        g?.lead?.soWhat ?? "",
        ...(g?.sections ?? []).flatMap((s) => s.paras ?? []),
      ].join(" ");
      return NUMBER_RE.test(text);
    })
    .slice(0, limit);
}

export function useEvidenceArticles(limit = 8) {
  return useQuery({
    queryKey: [...qk.articles(), "evidence", limit] as const,
    queryFn: () => listEvidenceArticles(limit),
  });
}

/** 홈 큐레이션 — 읽었지만 인사이트를 안 남긴 글(마저 인사이트 유도). 없으면 빈 배열. */
/**
 * 이어 읽기 — **읽던 흔적은 있는데 완독 기록이 없는 글.**
 *
 * 스크롤 진행률은 저장하지 않는다(완독 여부만 남긴다). 그래서 "읽다 만 글"은
 * **밑줄·담은 단어**로 안다 — 그 글을 열고 손을 댔다는 뜻이고, 완독(article_reads)에
 * 없으면 아직 끝내지 않은 것이다.
 *
 * 담아둔 글(북마크)은 여기 넣지 않는다. 그건 "읽을 글"이지 "읽던 글"이 아니고,
 * 아카이브 탭이 이미 맡고 있다.
 *
 * 비어 있으면 홈에서 **섹션째 사라진다** — 읽던 게 없는 사람에게 빈 칸을 보여주지 않는다.
 */
export async function listContinueReading(uid: string, limit = 10): Promise<ArticleWithBlog[]> {
  const [hl, words, reads] = await Promise.all([
    supabase
      .from("article_highlights")
      .select("article_id, created_at")
      .eq("author_id", uid)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("user_words")
      .select("article_id, created_at")
      .eq("user_id", uid)
      .not("article_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("article_reads").select("article_id").eq("user_id", uid),
  ]);
  if (hl.error) throw hl.error;
  if (words.error) throw words.error;
  if (reads.error) throw reads.error;

  const finished = new Set((reads.data ?? []).map((r) => r.article_id as string));
  /** 글마다 **마지막으로 손댄 시각** — 그 순서로 이어 읽기를 세운다. */
  const touched = new Map<string, string>();
  for (const row of [...(hl.data ?? []), ...(words.data ?? [])]) {
    const id = row.article_id as string | null;
    const at = (row.created_at as string | null) ?? "";
    if (!id || finished.has(id)) continue;
    const prev = touched.get(id);
    if (!prev || at > prev) touched.set(id, at);
  }
  const ids = [...touched.entries()]
    .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
    .slice(0, limit)
    .map(([id]) => id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
    .in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ArticleWithBlog[];
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function useContinueReading(limit = 10) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.articles(), "continue", uid, limit] as const,
    queryFn: () => listContinueReading(uid, limit),
    enabled: Boolean(uid),
  });
}

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
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT_WITH_BLOG)
    .not("planner_included", "is", false)
    .in("id", targetIds);
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
    .not("planner_included", "is", false)
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
 * 읽기 가이드 생성(§33) — 원문에 덧붙일 소개·용어·흐름 단계를 만들어 DB 에 저장한다.
 *
 * 글을 열 때 없으면 그 자리에서 한 번 만든다(수집 배치가 아직 안 돈 글 대비).
 * 게이트를 통과 못 하면 서버가 저장하지 않고 `ok:false` 를 돌려준다 —
 * 그때 화면은 가이드 없이 **지금까지 쓰던 모습**(AI 요약 + 본문 통짜)으로 뜬다.
 * 실패를 화면에 알리지 않는 이유: 읽는 사람이 할 수 있는 일이 없고, 원문은 멀쩡하기 때문이다.
 */
export interface GuideResult {
  ok: boolean;
  /** 실패했을 때 서버가 말해주는 이유("숫자 대조 실패" 등). 화면에 작게 보여준다. */
  reason?: string;
}

export async function requestReadingGuide(articleId: string): Promise<GuideResult> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { article_id: articleId, target: "guide" },
  });
  if (error) return { ok: false, reason: error.message };
  const r = (data ?? {}) as { ok?: boolean; reason?: string };
  return { ok: Boolean(r.ok), reason: r.reason };
}

export function useRequestReadingGuide(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestReadingGuide(articleId),
    onSuccess: (r) => {
      if (r.ok) qc.invalidateQueries({ queryKey: qk.article(articleId) });
    },
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
