import { createClient } from "@/lib/supabase/server";
import type { Company, Post, Review } from "@/lib/types";

// 기업 목록
export async function getCompanies(): Promise<Company[]> {
  const sb = await createClient();
  const { data } = await sb.from("companies").select("*").order("slug");
  return (data as Company[]) ?? [];
}

// 인사이트 수를 각 글에 붙이기
async function attachReviewCounts(sb: Awaited<ReturnType<typeof createClient>>, posts: Post[]): Promise<Post[]> {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const { data } = await sb.from("reviews").select("post_id").in("post_id", ids).eq("is_draft", false);
  const counts = new Map<string, number>();
  (data ?? []).forEach((r: { post_id: string }) => counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1));
  return posts.map((p) => ({ ...p, review_count: counts.get(p.id) ?? 0 }));
}

// 글별 읽음(완독) 수 붙이기 — 뷰수 대체 (통일 카드 메타)
async function attachReadCounts(sb: Awaited<ReturnType<typeof createClient>>, posts: Post[]): Promise<Post[]> {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const { data } = await sb.from("reads").select("post_id").in("post_id", ids);
  const counts = new Map<string, number>();
  (data ?? []).forEach((r: { post_id: string }) => counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1));
  return posts.map((p) => ({ ...p, read_count: counts.get(p.id) ?? 0 }));
}

// 피드: 전체 최신순 (인사이트 수 + 읽음 수 포함)
export async function getFeedPosts(): Promise<Post[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("posts")
    .select("*, company:companies(*), author:profiles!posts_author_id_fkey(name, initial)")
    .order("published_at", { ascending: false });
  const withReviews = await attachReviewCounts(sb, (data as unknown as Post[]) ?? []);
  return attachReadCounts(sb, withReviews);
}

// id 목록 → 글(작성자·인사이트 수·읽음 수 포함) — 마이·북마크·하이라이트 공통
export async function getPostsByIds(ids: string[]): Promise<Post[]> {
  if (!ids.length) return [];
  const sb = await createClient();
  const { data } = await sb.from("posts").select("*, company:companies(*), author:profiles!posts_author_id_fkey(name, initial)").in("id", ids);
  const withReviews = await attachReviewCounts(sb, (data as unknown as Post[]) ?? []);
  return attachReadCounts(sb, withReviews);
}

// 오늘의 글: 최근 7일 글 중 (읽음 수 + 인사이트 수) 1위 1개. 최근 글이 없으면 전체에서 선정
export function pickTodayHero(posts: Post[]): Post | null {
  const cutoff = Date.now() - 7 * 86_400_000;
  const recent = posts.filter((p) => new Date(p.published_at).getTime() >= cutoff);
  const pool = recent.length ? recent : posts;
  const score = (p: Post) => (p.read_count ?? 0) + (p.review_count ?? 0);
  return [...pool].sort((a, b) =>
    score(b) - score(a) ||
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0] ?? null;
}

// 인기 글: 인사이트 많은 순 → 동률 최신 (오늘의 글 제외)
export function pickPopular(posts: Post[], limit = 10, excludeId?: string): Post[] {
  return [...posts]
    .filter((p) => p.id !== excludeId)
    .sort((a, b) =>
      (b.review_count ?? 0) - (a.review_count ?? 0) ||
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit);
}

// 유저가 북마크한 글 목록 (Post[])
export async function getBookmarkedPosts(userId: string): Promise<Post[]> {
  const sb = await createClient();
  const { data: bms } = await sb.from("bookmarks").select("post_id").eq("user_id", userId);
  const ids = [...new Set((bms ?? []).map((b: { post_id: string }) => b.post_id))];
  return getPostsByIds(ids);
}

// 홈: 기업별 그룹 (기업 → 최신 글들)
export async function getPostsByCompany(): Promise<{ company: Company; posts: Post[] }[]> {
  const [companies, posts] = await Promise.all([getCompanies(), getFeedPosts()]);
  return companies
    .map((company) => ({
      company,
      posts: posts.filter((p) => p.company_id === company.id).slice(0, 8),
    }))
    .filter((g) => g.posts.length > 0);
}

// 유저가 하이라이트한 글 (highlights → 글)
export async function getHighlightedPosts(userId: string): Promise<Post[]> {
  const sb = await createClient();
  const { data: hs } = await sb.from("highlights").select("post_id").eq("user_id", userId);
  const postIds = [...new Set((hs ?? []).map((h: { post_id: string }) => h.post_id))];
  return getPostsByIds(postIds);
}

// 홈 추천 글: 인사이트 많은 순 → 동률이면 최신순 (상위 N)
export async function getRecommendedPosts(limit = 8): Promise<Post[]> {
  const posts = await getFeedPosts(); // review_count 포함
  return [...posts]
    .sort((a, b) =>
      (b.review_count ?? 0) - (a.review_count ?? 0) ||
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit);
}

// 유저가 북마크한 글 id 집합
export async function getBookmarkedPostIds(userId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data } = await sb.from("bookmarks").select("post_id").eq("user_id", userId);
  return new Set((data ?? []).map((b: { post_id: string }) => b.post_id));
}

// 유저가 다 읽은(스크롤 90%) 글 id 집합
export async function getReadPostIds(userId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data } = await sb.from("reads").select("post_id").eq("user_id", userId);
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

// 유저가 댓글 단 글 (댓글 → 인사이트 → 글)
export async function getCommentedPosts(userId: string): Promise<Post[]> {
  const sb = await createClient();
  const { data: cs } = await sb.from("comments").select("review_id").eq("author_id", userId);
  const reviewIds = [...new Set((cs ?? []).map((c: { review_id: string }) => c.review_id))];
  if (!reviewIds.length) return [];
  const { data: rs } = await sb.from("reviews").select("post_id").in("id", reviewIds);
  const postIds = [...new Set((rs ?? []).map((r: { post_id: string }) => r.post_id))];
  return getPostsByIds(postIds);
}

// 글 상세
export async function getPost(id: string): Promise<Post | null> {
  const sb = await createClient();
  const { data } = await sb.from("posts").select("*, company:companies(*)").eq("id", id).single();
  if (!data) return null;
  const [withCount] = await attachReviewCounts(sb, [data as Post]);
  return withCount;
}

// 인사이트 좋아요 수 + 내가 눌렀는지 (테이블 없으면 0/false 폴백)
async function attachReviewLikes(sb: Awaited<ReturnType<typeof createClient>>, reviews: Review[], userId: string): Promise<Review[]> {
  if (!reviews.length) return reviews;
  const ids = reviews.map((r) => r.id);
  const { data, error } = await sb.from("review_likes").select("review_id, user_id").in("review_id", ids);
  if (error) return reviews.map((r) => ({ ...r, like_count: 0, liked: false }));
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  (data ?? []).forEach((l: { review_id: string; user_id: string }) => {
    counts.set(l.review_id, (counts.get(l.review_id) ?? 0) + 1);
    if (l.user_id === userId) mine.add(l.review_id);
  });
  return reviews.map((r) => ({ ...r, like_count: counts.get(r.id) ?? 0, liked: mine.has(r.id) }));
}

async function attachCommentCounts(sb: Awaited<ReturnType<typeof createClient>>, reviews: Review[]): Promise<Review[]> {
  if (!reviews.length) return reviews;
  const ids = reviews.map((r) => r.id);
  const { data } = await sb.from("comments").select("review_id").in("review_id", ids);
  const counts = new Map<string, number>();
  (data ?? []).forEach((x: { review_id: string }) => counts.set(x.review_id, (counts.get(x.review_id) ?? 0) + 1));
  return reviews.map((r) => ({ ...r, comment_count: counts.get(r.id) ?? 0 }));
}

// 글에 달린 인사이트 (게시본)
export async function getReviewsForPost(postId: string, userId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles!reviews_author_id_fkey(name, initial)")
    .eq("post_id", postId)
    .eq("is_draft", false)
    .order("created_at", { ascending: false });
  const withComments = await attachCommentCounts(sb, (data as Review[]) ?? []);
  return attachReviewLikes(sb, withComments, userId);
}

// 인사이트 탭: 인사이트 최신순 (글 정보 포함)
export async function getInsightFeed(userId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles!reviews_author_id_fkey(name, initial), post:posts(title, company:companies(*))")
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(50);
  const withComments = await attachCommentCounts(sb, (data as Review[]) ?? []);
  return attachReviewLikes(sb, withComments, userId);
}

// 인사이트 탭 · 북마크: 내가 북마크한 글에 달린 인사이트 최신순
export async function getBookmarkedInsightFeed(userId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data: bms } = await sb.from("bookmarks").select("post_id").eq("user_id", userId);
  const postIds = [...new Set((bms ?? []).map((b: { post_id: string }) => b.post_id))];
  if (!postIds.length) return [];
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles!reviews_author_id_fkey(name, initial), post:posts(title, company:companies(*))")
    .in("post_id", postIds)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(50);
  const withComments = await attachCommentCounts(sb, (data as Review[]) ?? []);
  return attachReviewLikes(sb, withComments, userId);
}

// 홈 8섹션 데이터 (중복 노출 제거 + 폴백 포함)
export type HomeData = {
  hero: Post | null;
  keywords: string[];
  popular: Post[]; popularFallback: boolean;
  popularInsights: Review[]; popularInsightsFallback: boolean;
  unfinished: Post[];
  recommended: Post[];
  favNew: Post[]; favEmpty: boolean;
  direct: Post[];
};
export async function getHomeData(userId: string): Promise<HomeData> {
  const sb = await createClient();
  const posts = await getFeedPosts(); // company·author·review_count·read_count 포함
  const now = Date.now();
  const days = (p: Post, d: number) => now - new Date(p.published_at).getTime() <= d * 86_400_000;
  const recentCmp = (a: Post, b: Post) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  const seen = new Set<string>();
  const take = (list: Post[], n: number) => { const out: Post[] = []; for (const p of list) { if (seen.has(p.id)) continue; out.push(p); seen.add(p.id); if (out.length >= n) break; } return out; };

  // ① 오늘의 글
  const hero = pickTodayHero(posts);
  if (hero) seen.add(hero.id);

  // ② 인기 키워드 (최근 2주 tags 빈도 top 8)
  const freq = new Map<string, number>();
  posts.filter((p) => days(p, 14)).forEach((p) => (p.tags ?? []).forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1)));
  const keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);

  const feed = await getInsightFeed(userId); // 최근 인사이트, 최신순 (③④ 폴백에 재사용)
  const recent30 = posts.filter((p) => days(p, 30));
  const engage = (p: Post) => (p.review_count ?? 0) * 2 + (p.read_count ?? 0);

  // ③ 인기 글: 인사이트 2개+ 글 상위. 부족하면 → "최근 인사이트가 올라온 글"
  const strong = recent30.filter((p) => (p.review_count ?? 0) >= 2).sort((a, b) => engage(b) - engage(a) || recentCmp(a, b));
  const popularFallback = strong.length < 4;
  let popular: Post[];
  if (!popularFallback) {
    popular = take(strong, 10);
  } else {
    const pset = new Set<string>();
    const arr: Post[] = [];
    for (const r of feed) { if (pset.has(r.post_id)) continue; pset.add(r.post_id); const p = posts.find((x) => x.id === r.post_id); if (p) arr.push(p); }
    popular = take(arr, 10);
  }

  // ④ 인기 인사이트: 좋아요 상위, 없으면 → "최근 올라온 인사이트 최신순"
  const liked = [...feed].filter((r) => (r.like_count ?? 0) >= 1).sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || (b.comment_count ?? 0) - (a.comment_count ?? 0));
  const popularInsightsFallback = liked.length < 3;
  const popularInsights = (popularInsightsFallback ? feed : liked).slice(0, 10);

  // ⑤ 아직 안 끝난 글 (조회했으나 내 인사이트 없음)
  const { data: myRv } = await sb.from("reviews").select("post_id").eq("author_id", userId).eq("is_draft", false);
  const myReviewed = new Set((myRv ?? []).map((r: { post_id: string }) => r.post_id));
  const viewed = await getViewedPosts(userId);
  const unfinished = viewed.filter((p) => !myReviewed.has(p.id)).slice(0, 10);

  // ⑥ 추천 글 (내 활동 태그 유사도) — 내 활동 없으면 빈 배열
  const myTags = new Map<string, number>();
  [...viewed, ...posts.filter((p) => myReviewed.has(p.id))].forEach((p) => (p.tags ?? []).forEach((t) => myTags.set(t, (myTags.get(t) ?? 0) + 1)));
  let recommended: Post[] = [];
  if (myTags.size) {
    const scored = posts
      .filter((p) => !myReviewed.has(p.id))
      .map((p) => ({ p, s: (p.tags ?? []).reduce((s, t) => s + (myTags.get(t) ?? 0), 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || recentCmp(a.p, b.p));
    recommended = take(scored.map((x) => x.p), 10);
  }

  // ⑦ 즐겨찾기 기업 새 글 (없으면 유도 배너)
  const favs = await getFavoriteCompanyIds(userId);
  const favEmpty = favs.size === 0;
  const favNew = favEmpty ? [] : take(posts.filter((p) => p.company_id && favs.has(p.company_id)).sort(recentCmp), 10);

  // ⑧ 사용자 등록 글
  const direct = take(posts.filter((p) => p.source === "direct").sort(recentCmp), 10);

  return { hero, keywords, popular, popularFallback, popularInsights, popularInsightsFallback, unfinished, recommended, favNew, favEmpty, direct };
}

// 유저가 조회한 글 (post_views → 글), 최근 조회순
export async function getViewedPosts(userId: string): Promise<Post[]> {
  const sb = await createClient();
  const { data: vs, error } = await sb.from("post_views").select("post_id, viewed_at").eq("user_id", userId).order("viewed_at", { ascending: false }).limit(100);
  if (error) return [];
  const ids = [...new Set((vs ?? []).map((v: { post_id: string }) => v.post_id))];
  if (!ids.length) return [];
  const posts = await getPostsByIds(ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  return posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// 상세 페이지 인라인 댓글 스레드: 해당 글 인사이트들의 댓글 + 좋아요 수/내가 눌렀는지
export type ThreadComment = {
  id: string; review_id: string; parent_id: string | null; author_id: string;
  body: string; created_at: string; author?: { name: string; initial: string } | null;
  like_count: number; liked: boolean;
};
export async function getCommentsForReviews(reviewIds: string[], userId: string): Promise<ThreadComment[]> {
  if (!reviewIds.length) return [];
  const sb = await createClient();
  const { data } = await sb
    .from("comments")
    .select("id, review_id, parent_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(name, initial)")
    .in("review_id", reviewIds)
    .order("created_at", { ascending: true });
  const comments = (data as unknown as ThreadComment[]) ?? [];
  if (!comments.length) return [];
  const ids = comments.map((c) => c.id);
  const likeCounts = new Map<string, number>();
  const myLikes = new Set<string>();
  // comment_likes 테이블 미적용 환경에서도 안전하게
  const { data: likes, error } = await sb.from("comment_likes").select("comment_id, user_id").in("comment_id", ids);
  if (!error) {
    (likes ?? []).forEach((l: { comment_id: string; user_id: string }) => {
      likeCounts.set(l.comment_id, (likeCounts.get(l.comment_id) ?? 0) + 1);
      if (l.user_id === userId) myLikes.add(l.comment_id);
    });
  }
  return comments.map((c) => ({ ...c, like_count: likeCounts.get(c.id) ?? 0, liked: myLikes.has(c.id) }));
}

// 즐겨찾기한 기업 slug 집합
export async function getFavoriteCompanyIds(userId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data } = await sb.from("favorites").select("company_id").eq("user_id", userId);
  return new Set((data ?? []).map((f: { company_id: string }) => f.company_id));
}
