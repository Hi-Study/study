/**
 * TanStack Query 키 팩토리. 무효화(invalidate) 대상을 일관되게 참조하기 위한 단일 출처.
 *
 * ⚠️ 여기 없는 키는 만들지 않는다. 화면에서 배열 리터럴을 직접 쓰면 무효화 대상이 갈라진다.
 *    쓰지 않게 된 키는 **지운다** — 남겨두면 삭제한 기능이 아직 있는 것처럼 보인다.
 */
export const qk = {
  profile: (uid: string) => ["profile", uid] as const,

  // ===== distill =====
  blogs: () => ["blogs"] as const,
  favoriteBlogs: (uid: string) => ["favorite-blogs", uid] as const,
  popularTags: () => ["popular-tags"] as const,
  recommendedKeywords: (uid: string) => ["recommended-keywords", uid] as const,
  trendingSearches: () => ["trending-searches"] as const,
  articles: () => ["articles"] as const,
  article: (articleId: string) => ["article", articleId] as const,
  articlesByTopic: (topic: string) => ["articles", "topic", topic] as const,
  opinions: (articleId: string) => ["opinions", articleId] as const,
  myOpinions: (uid: string) => ["opinions", "mine", uid] as const,
  opinion: (opinionId: string) => ["opinion", opinionId] as const,
  // 댓글 스레드 — 인사이트에만 달린다(커뮤니티 자유글은 걷어냈다).
  threadComments: (kind: "opinion", id: string) => ["thread-comments", kind, id] as const,
  articleHighlights: (articleId: string, uid?: string) =>
    uid
      ? (["article-highlights", articleId, uid] as const)
      : (["article-highlights", articleId] as const),
  liked: (targetType: string, targetId: string, uid: string) =>
    ["liked", targetType, targetId, uid] as const,
  myHighlights: (uid: string) => ["my-highlights", uid] as const,
  words: (uid: string) => ["words", uid] as const,
  // 아카이브(§34) — 목록·아카이브별 글·이 글이 담긴 아카이브·완독률
  archives: (uid: string) => ["archives", uid] as const,
  archivedIds: (uid: string) => ["archives", "ids", uid] as const,
  allArchived: (uid: string) => ["archives", "all-articles", uid] as const,
  archiveArticles: (archiveId: string) => ["archive-articles", archiveId] as const,
  archivesOfArticle: (uid: string, articleId: string) =>
    ["archives", "of-article", uid, articleId] as const,
  readRate: (uid: string) => ["read-rate", uid] as const,
  myComments: (uid: string) => ["my-comments", uid] as const,
  reads: (uid: string) => ["reads", uid] as const,
  readIds: (uid: string) => ["read-ids", uid] as const,
  // 원탭 스탬프 · 읽기 통계 · 직군 배지 · 약한 영역 · 온보딩
  myStamps: (uid: string, articleId: string) => ["stamps", "mine", uid, articleId] as const,
  stampCounts: (articleId: string) => ["stamps", "counts", articleId] as const,
  readingStats: (uid: string) => ["reading-stats", uid] as const,
  readerRoles: (articleId: string) => ["reader-roles", articleId] as const,
  /** 목록 카드용 — 글마다 1등 직군을 한 번에. */
  allReaderRoles: () => ["reader-roles", "all"] as const,
  weakDomains: (uid: string) => ["weak-domains", uid] as const,
  myTopics: (uid: string) => ["my-topics", uid] as const,
  weeklyTogether: () => ["articles", "weekly-together"] as const,
};
