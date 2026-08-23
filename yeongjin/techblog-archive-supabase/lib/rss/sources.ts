// 자동 수집 대상 기업(PRD v0.2 4.11 — 꾸준히 콘텐츠를 올리는 기업). RSS 피드 URL을 실제로 확인한 곳만 등록한다.
// 네이버 D2, 컬리 등은 피드 접근이 막혀 있어(또는 확인 실패) 이후 추가한다.
export const RSS_SOURCES = [
  { company: "우아한형제들 기술블로그", feedUrl: "https://techblog.woowahan.com/feed/" },
  { company: "토스 기술 블로그", feedUrl: "https://toss.tech/rss.xml" },
  { company: "당근 기술 블로그", feedUrl: "https://medium.com/feed/daangn" },
] as const;

// 과거 글 수집 범위(확정, PRD v0.2 10.1): 2025-07-01 이후 발행 글만.
export const COLLECT_SINCE = new Date("2025-07-01T00:00:00Z");
