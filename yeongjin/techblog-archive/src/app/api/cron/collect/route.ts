import { NextRequest, NextResponse } from "next/server";
import { crawlAllCompanies } from "@/lib/crawler";

// 3.1: 실시간에 가까운 주기(5~15분)로 폴링. Vercel Cron 또는 로컬 스케줄러가 이 엔드포인트를 호출.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await crawlAllCompanies();
  return NextResponse.json({ results });
}
