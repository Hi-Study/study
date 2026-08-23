import { z } from "zod";

export const CATEGORIES = [
  "백엔드",
  "프론트엔드",
  "데이터·AI",
  "인프라·DevOps",
  "조직문화·프로세스",
  "기타",
] as const;

export const articleSchema = z.object({
  url: z.string().url("올바른 URL을 입력해주세요"),
  category: z.enum(CATEGORIES, {
    error: "카테고리를 선택해주세요",
  }),
  title: z.string().min(1, "제목이 필요해요"),
  company: z.string().min(1, "회사명이 필요해요"),
  thumbnailUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1)).default([]),
  impressivePart: z.string().min(20, "인상 깊은 부분은 20자 이상 적어주세요"),
  applyIdea: z.string().min(20, "접목하고 싶은 방법은 20자 이상 적어주세요"),
  discussionQuestion: z.string().min(20, "질문·토론하고 싶은 것은 20자 이상 적어주세요"),
});

export type ArticleInput = z.infer<typeof articleSchema>;

export const previewRequestSchema = z.object({
  url: z.string().url("올바른 URL을 입력해주세요"),
});
