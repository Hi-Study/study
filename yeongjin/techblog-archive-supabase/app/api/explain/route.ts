import { explainWithGroq } from "@/lib/ai/groq";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ text: z.string().min(1).max(2000) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 다시 시도해주세요." },
      { status: 503 },
    );
  }

  try {
    const explanation = await explainWithGroq(parsed.data.text);
    if (!explanation) throw new Error("empty result");
    return NextResponse.json({ explanation });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "설명 생성에 실패했어요" },
      { status: 500 },
    );
  }
}
