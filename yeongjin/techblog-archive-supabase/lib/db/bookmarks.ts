import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// AUTH_REQUIRED=false 로 로그인 없이 테스트하는 동안 쓰는 고정 사용자 키.
export const PREVIEW_USER_KEY = "preview-user";

export type BookmarkRecord = {
  id: string;
  article_id: string;
  user_key: string;
  created_at: string;
};

export async function listBookmarksByUser(userKey: string): Promise<BookmarkRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_key", userKey);
    return (data as BookmarkRecord[]) ?? [];
  }
  const items = await readCollection<BookmarkRecord>("bookmarks");
  return items.filter((b) => b.user_key === userKey);
}

export async function countBookmarksByArticle(): Promise<Record<string, number>> {
  let items: BookmarkRecord[];
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("bookmarks").select("article_id");
    items = (data as BookmarkRecord[]) ?? [];
  } else {
    items = await readCollection<BookmarkRecord>("bookmarks");
  }
  const counts: Record<string, number> = {};
  for (const b of items) {
    counts[b.article_id] = (counts[b.article_id] ?? 0) + 1;
  }
  return counts;
}

export async function toggleBookmark(
  articleId: string,
  userKey: string,
): Promise<{ bookmarked: boolean }> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_key", userKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("bookmarks").delete().eq("id", existing.id);
      return { bookmarked: false };
    }
    await supabase.from("bookmarks").insert({ article_id: articleId, user_key: userKey });
    return { bookmarked: true };
  }

  const items = await readCollection<BookmarkRecord>("bookmarks");
  const existingIndex = items.findIndex(
    (b) => b.article_id === articleId && b.user_key === userKey,
  );

  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
    await writeCollection("bookmarks", items);
    return { bookmarked: false };
  }

  items.push({
    id: randomUUID(),
    article_id: articleId,
    user_key: userKey,
    created_at: new Date().toISOString(),
  });
  await writeCollection("bookmarks", items);
  return { bookmarked: true };
}
