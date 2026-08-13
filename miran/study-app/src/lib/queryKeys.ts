import type { CommentTarget } from "@/types/database";

/**
 * TanStack Query 키 팩토리. 무효화(invalidate) 대상을 일관되게 참조하기 위한 단일 출처.
 */
export const qk = {
  profile: (uid: string) => ["profile", uid] as const,

  myStudies: () => ["studies", "mine"] as const,
  study: (studyId: string) => ["study", studyId] as const,
  members: (studyId: string) => ["members", studyId] as const,

  shares: (studyId: string) => ["shares", studyId] as const,
  share: (shareId: string) => ["share", shareId] as const,

  discussions: (studyId: string) => ["discussions", studyId] as const,
  discussion: (discussionId: string) => ["discussion", discussionId] as const,

  comments: (targetType: CommentTarget, targetId: string) =>
    ["comments", targetType, targetId] as const,

  notifications: () => ["notifications"] as const,
  dashboard: () => ["dashboard"] as const,

  // ===== distill =====
  blogs: () => ["blogs"] as const,
  favoriteBlogs: (uid: string) => ["favorite-blogs", uid] as const,
  popularTags: () => ["popular-tags"] as const,
  recommendedKeywords: (uid: string) => ["recommended-keywords", uid] as const,
  articles: () => ["articles"] as const,
  article: (articleId: string) => ["article", articleId] as const,
  articlesByBlog: (blogKey: string) => ["articles", "blog", blogKey] as const,
  articlesByTopic: (topic: string) => ["articles", "topic", topic] as const,
  opinions: (articleId: string) => ["opinions", articleId] as const,
  opinionsFeed: (sort?: "latest" | "popular") =>
    sort ? (["opinions", "feed", sort] as const) : (["opinions", "feed"] as const),
  opinion: (opinionId: string) => ["opinion", opinionId] as const,
  opinionComments: (opinionId: string) => ["opinion-comments", opinionId] as const,
  articleHighlights: (articleId: string, uid?: string) =>
    uid
      ? (["article-highlights", articleId, uid] as const)
      : (["article-highlights", articleId] as const),
  liked: (targetType: string, targetId: string, uid: string) =>
    ["liked", targetType, targetId, uid] as const,
  myHighlights: (uid: string) => ["my-highlights", uid] as const,
  words: (uid: string) => ["words", uid] as const,
  bookmarks: (uid: string) => ["bookmarks", uid] as const,
  bookmarkIds: (uid: string) => ["bookmark-ids", uid] as const,
  myComments: (uid: string) => ["my-comments", uid] as const,
  appNotifications: (uid: string) => ["app-notifications", uid] as const,
  appNotificationsUnread: (uid: string) => ["app-notifications", "unread", uid] as const,
  reads: (uid: string) => ["reads", uid] as const,
  readIds: (uid: string) => ["read-ids", uid] as const,
  drafts: (uid: string) => ["opinion-drafts", uid] as const,
  draft: (uid: string, articleId: string) => ["opinion-draft", uid, articleId] as const,
};
