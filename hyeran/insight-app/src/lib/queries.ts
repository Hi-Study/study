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

async function attachCommentCounts(sb: Awaited<ReturnType<typeof createClient>>, reviews: Review[]): Promise<Review[]> {
  if (!reviews.length) return reviews;
  const ids = reviews.map((r) => r.id);
  const { data } = await sb.from("comments").select("review_id").in("review_id", ids);
  const counts = new Map<string, number>();
  (data ?? []).forEach((x: { review_id: string }) => counts.set(x.review_id, (counts.get(x.review_id) ?? 0) + 1));
  return reviews.map((r) => ({ ...r, comment_count: counts.get(r.id) ?? 0 }));
}

// 글에 달린 인사이트 (게시본)
export async function getReviewsForPost(postId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles(name, initial)")
    .eq("post_id", postId)
    .eq("is_draft", false)
    .order("created_at", { ascending: false });
  return attachCommentCounts(sb, (data as Review[]) ?? []);
}

// 인사이트 탭: 인사이트 최신순 (글 정보 포함)
export async function getInsightFeed(): Promise<Review[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles(name, initial), post:posts(title, company:companies(*))")
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = (data as Review[]) ?? [];
  if (!reviews.length) return reviews;
  const ids = reviews.map((r) => r.id);
  const { data: c } = await sb.from("comments").select("review_id").in("review_id", ids);
  const counts = new Map<string, number>();
  (c ?? []).forEach((x: { review_id: string }) => counts.set(x.review_id, (counts.get(x.review_id) ?? 0) + 1));
  return reviews.map((r) => ({ ...r, comment_count: counts.get(r.id) ?? 0 }));
}

// 인사이트 탭 · 북마크: 내가 북마크한 글에 달린 인사이트 최신순
export async function getBookmarkedInsightFeed(userId: string): Promise<Review[]> {
  const sb = await createClient();
  const { data: bms } = await sb.from("bookmarks").select("post_id").eq("user_id", userId);
  const postIds = [...new Set((bms ?? []).map((b: { post_id: string }) => b.post_id))];
  if (!postIds.length) return [];
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles(name, initial), post:posts(title, company:companies(*))")
    .in("post_id", postIds)
    .eq("is_draft", false)
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = (data as Review[]) ?? [];
  if (!reviews.length) return reviews;
  const ids = reviews.map((r) => r.id);
  const { data: c } = await sb.from("comments").select("review_id").in("review_id", ids);
  const counts = new Map<string, number>();
  (c ?? []).forEach((x: { review_id: string }) => counts.set(x.review_id, (counts.get(x.review_id) ?? 0) + 1));
  return reviews.map((r) => ({ ...r, comment_count: counts.get(r.id) ?? 0 }));
}

// 즐겨찾기한 기업 slug 집합
export async function getFavoriteCompanyIds(userId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data } = await sb.from("favorites").select("company_id").eq("user_id", userId);
  return new Set((data ?? []).map((f: { company_id: string }) => f.company_id));
}
