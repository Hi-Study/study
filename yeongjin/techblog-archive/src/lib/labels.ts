import type { Category, ReadStatus, DiscussionStatus } from "@/generated/prisma/enums";

export const CATEGORY_LABELS: Record<Category, string> = {
  BACKEND: "백엔드",
  FRONTEND: "프론트엔드",
  DATA_AI: "데이터·AI",
  INFRA_DEVOPS: "인프라·DevOps",
  CULTURE_PROCESS: "조직문화·프로세스",
  ETC: "기타",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];

export const READ_STATUS_LABELS: Record<ReadStatus, string> = {
  BEFORE: "읽기 전",
  READING: "읽는 중",
  DONE: "다 읽음",
};

export const DISCUSSION_STATUS_LABELS: Record<DiscussionStatus, string> = {
  OPEN: "모집 중",
  IN_PROGRESS: "진행 중",
  CLOSED: "종료",
};

export function formatRelativeDate(date: Date | null): string {
  if (!date) return "발행일 미상";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
