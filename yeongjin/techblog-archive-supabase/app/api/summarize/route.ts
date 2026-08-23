import { summarizeArticle } from "@/lib/ai/summarize-article";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ articleId: z.string() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  const result = await summarizeArticle(parsed.data.articleId);
  if (!result.ok) {
    const status =
      result.error === "글을 찾을 수 없어요"
        ? 404
        : result.error.startsWith("GEMINI_API_KEY가")
          ? 503
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
