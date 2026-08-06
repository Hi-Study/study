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
  articles: () => ["articles"] as const,
  article: (articleId: string) => ["article", articleId] as const,
  articlesByBlog: (blogKey: string) => ["articles", "blog", blogKey] as const,
  articlesByTopic: (topic: string) => ["articles", "topic", topic] as const,
  opinions: (articleId: string) => ["opinions", articleId] as const,
  opinionsFeed: () => ["opinions", "feed"] as const,
  opinion: (opinionId: string) => ["opinion", opinionId] as const,
  opinionComments: (opinionId: string) => ["opinion-comments", opinionId] as const,
  articleHighlights: (articleId: string) => ["article-highlights", articleId] as const,
};
