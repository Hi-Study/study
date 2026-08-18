import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

export type CommentRecord = {
  id: string;
  article_id: string;
  parent_id: string | null;
  user_key: string | null;
  author_name: string;
  body: string;
  created_at: string;
};

export async function listCommentsByArticle(articleId: string): Promise<CommentRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("article_id", articleId)
      .order("created_at", { ascending: true });
    return (data as CommentRecord[]) ?? [];
  }
  const items = await readCollection<CommentRecord>("comments");
  return items
    .filter((c) => c.article_id === articleId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function countCommentsByArticle(): Promise<Record<string, number>> {
  let items: CommentRecord[];
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("comments").select("article_id");
    items = (data as CommentRecord[]) ?? [];
  } else {
    items = await readCollection<CommentRecord>("comments");
  }
  const counts: Record<string, number> = {};
  for (const c of items) {
    counts[c.article_id] = (counts[c.article_id] ?? 0) + 1;
  }
  return counts;
}

export async function addComment(input: {
  articleId: string;
  parentId: string | null;
  userKey: string | null;
  authorName: string;
  body: string;
}): Promise<CommentRecord> {
  const record: CommentRecord = {
    id: randomUUID(),
    article_id: input.articleId,
    parent_id: input.parentId,
    user_key: input.userKey,
    author_name: input.authorName,
    body: input.body,
    created_at: new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .insert({
        article_id: record.article_id,
        parent_id: record.parent_id,
        user_key: record.user_key,
        author_name: record.author_name,
        body: record.body,
      })
      .select("*")
      .single();
    return (data as CommentRecord) ?? record;
  }

  const items = await readCollection<CommentRecord>("comments");
  items.push(record);
  await writeCollection("comments", items);
  return record;
}

export async function listCommentsByUser(userKey: string): Promise<CommentRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("user_key", userKey)
      .order("created_at", { ascending: false });
    return (data as CommentRecord[]) ?? [];
  }

  const items = await readCollection<CommentRecord>("comments");
  return items
    .filter((c) => c.user_key === userKey)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
