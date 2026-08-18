import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 읽은 아티클 트래킹(PRD v0.2 4.8) — 글 상세 화면 진입 시점에 "읽음"으로 기록한다.
// v0.1의 3단계 읽기 상태(읽기 전/읽는 중/다 읽음)는 v0.2에서 단순화되어 폐기됨.
export type ReadRecord = {
  id: string;
  article_id: string;
  user_key: string;
  read_at: string;
};

export async function markArticleRead(articleId: string, userKey: string): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("reads")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_key", userKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("reads").update({ read_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("reads").insert({ article_id: articleId, user_key: userKey });
    }
    return;
  }

  const items = await readCollection<ReadRecord>("reads");
  const idx = items.findIndex((r) => r.article_id === articleId && r.user_key === userKey);
  const now = new Date().toISOString();
  if (idx >= 0) {
    items[idx] = { ...items[idx], read_at: now };
  } else {
    items.push({ id: randomUUID(), article_id: articleId, user_key: userKey, read_at: now });
  }
  await writeCollection("reads", items);
}

// 피드 "조회순" 정렬용 — 글별로 읽은(방문한) 사람 수를 센다.
export async function countReadsByArticle(): Promise<Record<string, number>> {
  let items: ReadRecord[];
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("reads").select("article_id");
    items = (data as ReadRecord[]) ?? [];
  } else {
    items = await readCollection<ReadRecord>("reads");
  }
  const counts: Record<string, number> = {};
  for (const r of items) counts[r.article_id] = (counts[r.article_id] ?? 0) + 1;
  return counts;
}

export async function listReadsByUser(userKey: string): Promise<ReadRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("reads")
      .select("*")
      .eq("user_key", userKey)
      .order("read_at", { ascending: false });
    return (data as ReadRecord[]) ?? [];
  }

  const items = await readCollection<ReadRecord>("reads");
  return items
    .filter((r) => r.user_key === userKey)
    .sort((a, b) => b.read_at.localeCompare(a.read_at));
}
