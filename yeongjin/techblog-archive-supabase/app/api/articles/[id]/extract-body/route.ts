import { extractArticleBody } from "@/lib/content/extract-body";
import { getArticleById, updateArticleBody } from "@/lib/db/articles";
import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "글을 찾을 수 없어요" }, { status: 404 });

  const extracted = await extractArticleBody(article.url);
  if (!extracted) {
    return NextResponse.json(
      { error: "본문을 가져오지 못했어요. 원문 사이트에서 접근을 막고 있을 수 있어요." },
      { status: 502 },
    );
  }

  await updateArticleBody(id, extracted);
  return NextResponse.json({ ok: true });
}
