import { createClient } from "@/lib/supabase/server";
import { certaintyRank, ARTICLE_KINDS, USER_PROBLEMS, MAKER_PROBLEMS, IMPACT_TARGETS, ARTICLE_FLAGS,
  type Company, type CommunityPost, type Post, type Review, type Word } from "@/lib/types";

// 목록 화면용 컬럼.
// body(글 원문, 평균 8.8KB)와 ai_summary·terms(상세 전용)를 뺀다.
//
// ⚠️ company:companies(*) 임베드를 쓰지 않는다. 기업은 23곳뿐인데 글 313건에
//    전부 붙어 오면서 쿼리가 68ms → 736ms 로 10배 느려졌다.
//    기업 목록을 한 번만 받아 메모리에서 붙인다.
const LIST_COLS =
  // 카드에 그리는 것
  "id, company_id, title, headline, source, author_id, published_at, " +
  // 필터·정렬에 쓰는 것
  "article_kind, problem_type, impact_targets, result_certainty, flags, tags, view_count";
const LIST_SELECT = LIST_COLS;

// 기업·작성자를 메모리에서 붙인다 (임베드 대신)
async function attachRefs(sb: Awaited<ReturnType<typeof createClient>>, posts: Post[]): Promise<Post[]> {
  if (!posts.length) return posts;
  const { data: cos } = await sb.from("companies").select("*");
  const coMap = new Map((cos ?? []).map((c) => [c.id, c as Company]));

  // 직접 등록 글만 작성자가 있다 — 대개 몇 건뿐이라 그때만 조회한다
  const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))] as string[];
  const auMap = new Map<string, { name: string; initial: string }>();
  if (authorIds.length) {
    const { data: aus } = await sb.from("profiles").select("id, name, initial").in("id", authorIds);
    (aus ?? []).forEach((a: { id: string; name: string; initial: string }) =>
      auMap.set(a.id, { name: a.name, initial: a.initial }));
  }
  return posts.map((p) => ({
    ...p,
    company: p.company_id ? coMap.get(p.company_id) ?? null : null,
    author: p.author_id ? auMap.get(p.author_id) ?? null : null,
  }));
}

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

// 피드: 전체 최신순
export async function getFeedPosts(): Promise<Post[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("posts")
    .select(LIST_SELECT)
    .order("published_at", { ascending: false });
  return attachRefs(sb, (data as unknown as Post[]) ?? []);
}

// id 목록 → 글(작성자·인사이트 수 포함) — 마이·북마크·하이라이트 공통
export async function getPostsByIds(ids: string[]): Promise<Post[]> {
  if (!ids.length) return [];
  const sb = await createClient();
  const { data } = await sb.from("posts").select(LIST_SELECT).in("id", ids);
  return attachRefs(sb, (data as unknown as Post[]) ?? []);
}

// 오늘의 글: 최근 7일 글 중 (조회수 + 인사이트 수) 1위 1개. 최근 글이 없으면 전체에서 선정
export function pickTodayHero(posts: Post[]): Post | null {
  const cutoff = Date.now() - 7 * 86_400_000;
  const recent = posts.filter((p) => new Date(p.published_at).getTime() >= cutoff);
  const pool = recent.length ? recent : posts;
  const score = (p: Post) => (p.view_count ?? 0) + (p.review_count ?? 0);
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
  const { data, error } = await sb.from("likes").select("target_id, user_id").eq("target_type", "review").in("target_id", ids);
  if (error) return reviews.map((r) => ({ ...r, like_count: 0, liked: false }));
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  (data ?? []).forEach((l: { target_id: string; user_id: string }) => {
    counts.set(l.target_id, (counts.get(l.target_id) ?? 0) + 1);
    if (l.user_id === userId) mine.add(l.target_id);
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

// ── 홈 큐레이션 섹션 [분류체계 §6-1] ─────────────────────────
// 섹션 제목은 카피이고 분류값이 아니다. 분류값 자체는 화면에 노출하지 않는다.
// 후보 6편 미만이면 섹션을 숨기고, 한 화면에서 같은 글은 한 번만 보인다.
export type HomeSection = { title: string; sub: string; posts: Post[] };
export type HomeData = {
  sections: HomeSection[];
  latest: Post[];       // "새로 들어온 글" — 항상 마지막
};

const SECTION_DEFS: { title: string; sub: string; match: (p: Post) => boolean }[] = [
  {
    title: "AI, 다들 실제로는 이렇게 쓰고 있어요",
    sub: "제품에 붙인 것 말고, 만드는 과정에 쓴 이야기",
    match: (p) => p.flags?.includes("개발 과정에 AI") || p.problem_type === "AI 출력 통제",
  },
  {
    title: "사용자가 느끼는 게 달라졌어요",
    sub: "화면 밖에서 실제로 무엇이 바뀌었는지까지 나온 글",
    match: (p) => !!p.impact_targets?.includes("사용자 경험") && p.result_certainty !== "없음",
  },
  {
    title: "생각대로 안 됐을 때, 이렇게 했대요",
    sub: "잘하는 팀도 기대와 다른 결과를 받습니다",
    match: (p) => !!p.flags?.includes("기대와 다른 결과"),
  },
  {
    title: "사서 쓰는 대신 직접 만들기로 했어요",
    sub: "무엇이 부족해서 그런 결정을 했는지",
    match: (p) => !!p.flags?.includes("직접 만들기"),
  },
  {
    title: "손으로 하던 일을 없앤 사례",
    sub: "운영·어드민 수작업을 줄인 팀들",
    match: (p) =>
      (p.problem_type === "운영·어드민" || p.problem_type === "개발 생산성") &&
      !!p.impact_targets?.includes("내부 생산성"),
  },
];

const MIN_SECTION = 6; // 후보가 이보다 적으면 섹션째 숨긴다
const PER_SECTION = 8; // 카드 8장까지, 가로 스와이프

export async function getHomeData(): Promise<HomeData> {
  const posts = await getFeedPosts();
  const recentCmp = (a: Post, b: Post) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  // 같은 섹션 안에서는 수치 > 정성 > 없음 → 발행일 내림차순
  const bySection = (a: Post, b: Post) =>
    certaintyRank(a.result_certainty) - certaintyRank(b.result_certainty) || recentCmp(a, b);

  const used = new Set<string>();

  const sections: HomeSection[] = [];
  for (const def of SECTION_DEFS) {
    const cands = posts.filter((p) => !used.has(p.id) && def.match(p));
    if (cands.length < MIN_SECTION) continue; // 억지로 채우면 섹션 제목이 거짓이 된다
    const picked = cands.sort(bySection).slice(0, PER_SECTION);
    picked.forEach((p) => used.add(p.id));
    sections.push({ title: def.title, sub: def.sub, posts: picked });
  }

  const latest = posts.filter((p) => !used.has(p.id)).sort(recentCmp).slice(0, PER_SECTION);
  return { sections, latest };
}


// ── 홈 통계 [수집·판정 현황 파악용] ────────────────────────
// 서비스를 쓰기 전에 "어떤 글이 올라오고 있나"를 먼저 봐야 한다.
// 각 항목은 피드로 링크되어 그 묶음의 글을 실제로 읽어볼 수 있다.
export type StatRow = { label: string; count: number; href?: string };
export type StatsData = {
  total: number;
  judged: number;
  companies: StatRow[];
  kinds: StatRow[];
  userProblems: StatRow[];   // 서비스를 쓰는 사람이 겪는 문제
  makerProblems: StatRow[];  // 만드는 쪽이 겪는 문제
  noProblem: StatRow;        // 17개 어디에도 안 맞은 글
  impacts: StatRow[];
  certainties: StatRow[];
  flags: StatRow[];
};

export async function getStats(): Promise<StatsData> {
  const sb = await createClient();
  const [{ data: posts }, { data: cos }] = await Promise.all([
    sb.from("posts").select("company_id, article_kind, problem_type, impact_targets, result_certainty, flags, headline"),
    sb.from("companies").select("id, name, slug"),
  ]);
  const list = posts ?? [];
  const coName = new Map((cos ?? []).map((c) => [c.id, c] as const));

  const tally = (key: (p: (typeof list)[number]) => (string | null)[]) => {
    const m = new Map<string, number>();
    for (const p of list) for (const v of key(p)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const rows = (m: Map<string, number>, order: string[], q: string): StatRow[] =>
    order.map((k) => ({ label: k, count: m.get(k) ?? 0, href: `/feed?${q}=${encodeURIComponent(k)}` }))
      .sort((a, b) => b.count - a.count);

  const kindM = tally((p) => [p.article_kind]);
  const probM = tally((p) => [p.problem_type]);
  const impM = tally((p) => p.impact_targets ?? []);
  const certM = tally((p) => [p.result_certainty]);
  const flagM = tally((p) => p.flags ?? []);

  const byCo = new Map<string, number>();
  for (const p of list) if (p.company_id) byCo.set(p.company_id, (byCo.get(p.company_id) ?? 0) + 1);

  const nullProblem = list.filter((p) => !p.problem_type).length;

  return {
    total: list.length,
    judged: list.filter((p) => p.headline).length,
    companies: [...byCo.entries()]
      .map(([id, count]) => ({ label: coName.get(id)?.name ?? "기타", count, href: `/companies/${coName.get(id)?.slug ?? ""}` }))
      .sort((a, b) => b.count - a.count),
    kinds: rows(kindM, ARTICLE_KINDS, "kind"),
    userProblems: rows(probM, USER_PROBLEMS, "pt"),
    makerProblems: rows(probM, MAKER_PROBLEMS, "pt"),
    noProblem: { label: "17개 어디에도 안 맞음", count: nullProblem, href: "/feed?pt=none" },
    impacts: rows(impM, IMPACT_TARGETS, "it"),
    certainties: rows(certM, ["수치", "정성", "없음"], "rc"),
    flags: rows(flagM, ARTICLE_FLAGS, "flag"),
  };
}

// 같은 problem_type 의 다른 글 — 상세 하단 "같은 문제를 다룬 사례" [분류체계 §6-2]
export async function getRelatedByProblem(postId: string, problemType: string | null, limit = 3): Promise<Post[]> {
  if (!problemType) return [];
  const sb = await createClient();
  const { data } = await sb.from("posts").select(LIST_SELECT)
    .eq("problem_type", problemType).neq("id", postId)
    .order("published_at", { ascending: false }).limit(limit);
  return attachRefs(sb, (data as unknown as Post[]) ?? []);
}

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
  // 범용 likes 에서 댓글 좋아요 집계 (테이블 없어도 안전하게)
  const { data: likes, error } = await sb.from("likes").select("target_id, user_id").eq("target_type", "comment").in("target_id", ids);
  if (!error) {
    (likes ?? []).forEach((l: { target_id: string; user_id: string }) => {
      likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
      if (l.user_id === userId) myLikes.add(l.target_id);
    });
  }
  return comments.map((c) => ({ ...c, like_count: likeCounts.get(c.id) ?? 0, liked: myLikes.has(c.id) }));
}

// ===== 커뮤니티 자유글 [v3.0] =====

async function attachCommunityMeta(sb: Awaited<ReturnType<typeof createClient>>, posts: CommunityPost[], userId: string): Promise<CommunityPost[]> {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const [likesRes, cmtRes] = await Promise.all([
    sb.from("likes").select("target_id, user_id").eq("target_type", "community_post").in("target_id", ids),
    sb.from("comments").select("target_id").eq("target_type", "community_post").in("target_id", ids),
  ]);
  const likeCounts = new Map<string, number>(); const mine = new Set<string>();
  (likesRes.data ?? []).forEach((l: { target_id: string; user_id: string }) => {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
    if (l.user_id === userId) mine.add(l.target_id);
  });
  const cmtCounts = new Map<string, number>();
  (cmtRes.data ?? []).forEach((c: { target_id: string }) => cmtCounts.set(c.target_id, (cmtCounts.get(c.target_id) ?? 0) + 1));
  return posts.map((p) => ({ ...p, like_count: likeCounts.get(p.id) ?? 0, liked: mine.has(p.id), comment_count: cmtCounts.get(p.id) ?? 0 }));
}

// 커뮤니티 피드 (최신순)
export async function getCommunityFeed(userId: string): Promise<CommunityPost[]> {
  const sb = await createClient();
  const { data } = await sb.from("community_posts")
    .select("*, author:profiles!community_posts_author_id_fkey(name, initial)")
    .order("created_at", { ascending: false });
  return attachCommunityMeta(sb, (data as unknown as CommunityPost[]) ?? [], userId);
}

// 내가 쓴 자유글 (마이용)
export async function getMyCommunityPosts(userId: string): Promise<CommunityPost[]> {
  const sb = await createClient();
  const { data } = await sb.from("community_posts")
    .select("*, author:profiles!community_posts_author_id_fkey(name, initial)")
    .eq("author_id", userId).order("created_at", { ascending: false });
  return attachCommunityMeta(sb, (data as unknown as CommunityPost[]) ?? [], userId);
}

// 자유글 1개
export async function getCommunityPost(id: string, userId: string): Promise<CommunityPost | null> {
  const sb = await createClient();
  const { data } = await sb.from("community_posts")
    .select("*, author:profiles!community_posts_author_id_fkey(name, initial)")
    .eq("id", id).maybeSingle();
  if (!data) return null;
  const [p] = await attachCommunityMeta(sb, [data as unknown as CommunityPost], userId);
  return p;
}

// 대상(자유글 등)에 달린 댓글 스레드 (범용)
export async function getCommentsForTarget(targetType: string, targetId: string, userId: string): Promise<ThreadComment[]> {
  const sb = await createClient();
  const { data } = await sb.from("comments")
    .select("id, target_id, parent_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(name, initial)")
    .eq("target_type", targetType).eq("target_id", targetId)
    .order("created_at", { ascending: true });
  const raw = (data as unknown as (ThreadComment & { target_id: string })[]) ?? [];
  if (!raw.length) return [];
  const comments = raw.map((c) => ({ ...c, review_id: c.target_id })); // ThreadComment 호환(review_id에 target_id 매핑)
  const ids = comments.map((c) => c.id);
  const likeCounts = new Map<string, number>(); const myLikes = new Set<string>();
  const { data: likes } = await sb.from("likes").select("target_id, user_id").eq("target_type", "comment").in("target_id", ids);
  (likes ?? []).forEach((l: { target_id: string; user_id: string }) => {
    likeCounts.set(l.target_id, (likeCounts.get(l.target_id) ?? 0) + 1);
    if (l.user_id === userId) myLikes.add(l.target_id);
  });
  return comments.map((c) => ({ ...c, like_count: likeCounts.get(c.id) ?? 0, liked: myLikes.has(c.id) }));
}

// 내 단어장
export async function getMyWords(userId: string): Promise<Word[]> {
  const sb = await createClient();
  const { data } = await sb.from("words").select("id, term, meaning, post_id, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  return (data as Word[]) ?? [];
}

// 내가 인사이트 남긴 날짜(ISO) — 마이 캘린더/이번 달 카운트용
export async function getMyReviewDates(userId: string): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("reviews").select("created_at").eq("author_id", userId).eq("is_draft", false);
  return (data ?? []).map((r: { created_at: string }) => r.created_at);
}

// 즐겨찾기한 기업 slug 집합
export async function getFavoriteCompanyIds(userId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data } = await sb.from("favorites").select("company_id").eq("user_id", userId);
  return new Set((data ?? []).map((f: { company_id: string }) => f.company_id));
}
