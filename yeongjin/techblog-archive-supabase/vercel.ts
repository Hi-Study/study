import type { VercelConfig } from "@vercel/config/v1";

// RSS 자동 수집(PRD v0.2 4.11) 스케줄러 — /api/cron/collect를 주기적으로 호출한다.
// Vercel 프로젝트 환경변수에 CRON_SECRET을 설정하면 Vercel이 자동으로 인증 헤더를 붙여 호출한다.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/cron/collect", schedule: "0 * * * *" }],
};
