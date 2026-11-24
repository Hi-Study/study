import { NextResponse } from "next/server";
import { companyLogo } from "@/core/0-collect/logos";
import { listArticles } from "@/core/shared/db";
import { experienceStats } from "@/core/3-place/home";

/**
 * STEP 03 데모 글 — 특정 글을 하드코딩하지 않고, 사례가 가장 많이 쌓인 경험 유형의 대표 글을 고른다.
 * 온보딩 팝업이 실제로 열렸을 때(클라이언트가 부를 때)만 계산한다 — layout 에 두면 모든 화면마다
 * 전체 글을 긁어와야 해서 여기로 뺐다(STEP 04 recommend 와 같은 방식).
 */
export async function GET() {
  const rows = await listArticles("included");
  const stats = experienceStats(rows);
  const article = stats.find((s) => s.example)?.example ?? rows[0] ?? null;
  const logo = article ? companyLogo(article.companyId) : null;
  return NextResponse.json({ article, logo }, { headers: { "Cache-Control": "no-store" } });
}
