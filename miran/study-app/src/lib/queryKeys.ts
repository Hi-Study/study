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
};
