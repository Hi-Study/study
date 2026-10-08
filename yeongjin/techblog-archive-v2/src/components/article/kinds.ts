import type { AnnKind } from "@/core/1-analyze/annotate";

/**
 * 원문 하이라이트 종류별 이름·색. 서버 화면(글 상세의 범례·못 찾은 관점 목록)과
 * 브라우저 화면(하이라이트 설명창)이 함께 쓴다 — 그래서 "use client" 파일에 두지 않는다.
 * ("use client" 파일의 값을 서버에서 읽으면 비어 있어 글 상세가 500 오류를 냈다)
 */
export const KIND_LABEL: Record<AnnKind, { label: string; dot: string; chip: string }> = {
  problem: { label: "문제 정의", dot: "bg-[#f5c400]", chip: "bg-[var(--problem)] text-[var(--problem-ink)]" },
  technology: { label: "기술 이해", dot: "bg-[#60a5fa]", chip: "bg-[var(--tech)] text-[var(--tech-ink)]" },
  experience: { label: "경험 변화", dot: "bg-[#34c759]", chip: "bg-[var(--exp)] text-[var(--exp-ink)]" },
};
