import { collectFromAllSources } from "@/lib/rss/collect";
import { NextResponse } from "next/server";

// 최초 실행 시 2025-07-01 이후 백로그를 한 번에 요약까지 처리하느라 오래 걸릴 수 있어 넉넉히 잡는다.
// 이후 실행은 새 글만 처리해 훨씬 짧게 끝난다(URL 중복 검사로 스킵).
export const maxDuration = 300;

// Vercel Cron이 호출하는 자동 수집 엔드포인트(PRD v0.2 4.11).
// CRON_SECRET을 설정해두면 Vercel이 자동으로 보내는 Authorization 헤더로 검증한다.
// (미설정 시에는 로컬 개발에서 바로 curl로 테스트할 수 있도록 검증을 건너뛴다.)
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await collectFromAllSources();
  return NextResponse.json({ results });
}
