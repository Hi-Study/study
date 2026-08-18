import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 형광펜 + 개인 메모(PRD 4.9) — 본문 전체를 저장하지 않는 정책이라, 우리가 실제로
// 갖고 있는 AI 요약/독후감 텍스트 안에서 드래그한 구간만 하이라이트 대상으로 삼는다.
// 공개 범위는 나만 보기로 확정(FEATURE_PUBLIC_HIGHLIGHTS=false)되어 있어 user_key로만 필터한다.
// 하이라이트 영역(zone) — "어디에 많이 표시했는지" 분포를 보여주기 위한 구획.
// 페이지 번호가 없는 웹 글이라, 콘텐츠 3영역(AI요약/독후감/본문)을 기준으로 나눈다.
export type HighlightZone = "ai_summary" | "note" | "body";

export type HighlightRecord = {
  id: string;
  article_id: string;
  user_key: string;
  quote: string;
  note: string | null;
  zone: HighlightZone;
  created_at: string;
};

export async function listHighlightsByArticleAndUser(
  articleId: string,
  userKey: string,
): Promise<HighlightRecord[]> {
  const all = await listHighlightsByUser(userKey);
  return all
    .filter((h) => h.article_id === articleId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function listHighlightsByUser(userKey: string): Promise<HighlightRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("highlights")
      .select("*")
      .eq("user_key", userKey)
      .order("created_at", { ascending: false });
    return (data as HighlightRecord[]) ?? [];
  }
  const items = await readCollection<HighlightRecord>("highlights");
  return items
    .filter((h) => h.user_key === userKey)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addHighlight(input: {
  articleId: string;
  userKey: string;
  quote: string;
  note: string | null;
  zone: HighlightZone;
}): Promise<HighlightRecord> {
  const record: HighlightRecord = {
    id: randomUUID(),
    article_id: input.articleId,
    user_key: input.userKey,
    quote: input.quote,
    note: input.note,
    zone: input.zone,
    created_at: new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("highlights")
      .insert({
        article_id: record.article_id,
        user_key: record.user_key,
        quote: record.quote,
        note: record.note,
        zone: record.zone,
      })
      .select("*")
      .single();
    return (data as HighlightRecord) ?? record;
  }

  const items = await readCollection<HighlightRecord>("highlights");
  items.push(record);
  await writeCollection("highlights", items);
  return record;
}

export async function deleteHighlight(id: string, userKey: string): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("highlights").delete().eq("id", id).eq("user_key", userKey);
    return;
  }

  const items = await readCollection<HighlightRecord>("highlights");
  const next = items.filter((h) => !(h.id === id && h.user_key === userKey));
  await writeCollection("highlights", next);
}
