import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 급상승 검색어(PRD v0.2 4.7) — 실행된 검색어를 그대로 로그로 쌓고 누적 횟수로 집계한다.
export type SearchLogRecord = {
  id: string;
  query: string;
  created_at: string;
};

export async function logSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;

  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("search_logs").insert({ query: trimmed });
    return;
  }

  const items = await readCollection<SearchLogRecord>("search_logs");
  items.push({ id: randomUUID(), query: trimmed, created_at: new Date().toISOString() });
  await writeCollection("search_logs", items);
}

export async function topSearchQueries(limit: number): Promise<{ query: string; count: number }[]> {
  let items: SearchLogRecord[];
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("search_logs").select("query");
    items = (data as SearchLogRecord[]) ?? [];
  } else {
    items = await readCollection<SearchLogRecord>("search_logs");
  }

  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.query, (counts.get(item.query) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query, count]) => ({ query, count }));
}
