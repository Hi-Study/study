import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 임시저장(PRD v0.2 4.8) — 글 등록 폼을 끝까지 못 채운 경우 이어서 작성할 수 있게
// 폼 상태를 통째로 JSON으로 저장해둔다. 엄격한 스키마 검증은 최종 등록 시에만 적용한다.
export type ArticleDraftData = {
  url: string;
  category: string;
  tagsInput: string;
  preview: { title: string; company: string; thumbnailUrl: string | null } | null;
  notes: { impressivePart: string; applyIdea: string; discussionQuestion: string };
};

export type DraftRecord = {
  id: string;
  user_key: string;
  data: ArticleDraftData;
  updated_at: string;
};

export async function listDraftsByUser(userKey: string): Promise<DraftRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("drafts")
      .select("*")
      .eq("user_key", userKey)
      .order("updated_at", { ascending: false });
    return (data as DraftRecord[]) ?? [];
  }
  const items = await readCollection<DraftRecord>("drafts");
  return items
    .filter((d) => d.user_key === userKey)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getDraftById(id: string, userKey: string): Promise<DraftRecord | null> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("drafts")
      .select("*")
      .eq("id", id)
      .eq("user_key", userKey)
      .maybeSingle();
    return (data as DraftRecord) ?? null;
  }
  const items = await readCollection<DraftRecord>("drafts");
  return items.find((d) => d.id === id && d.user_key === userKey) ?? null;
}

export async function saveDraft(input: {
  id: string | null;
  userKey: string;
  data: ArticleDraftData;
}): Promise<DraftRecord> {
  const now = new Date().toISOString();

  if (USE_SUPABASE) {
    const supabase = await createClient();
    if (input.id) {
      const { data } = await supabase
        .from("drafts")
        .update({ data: input.data, updated_at: now })
        .eq("id", input.id)
        .eq("user_key", input.userKey)
        .select("*")
        .single();
      if (data) return data as DraftRecord;
    }
    const { data } = await supabase
      .from("drafts")
      .insert({ user_key: input.userKey, data: input.data })
      .select("*")
      .single();
    return data as DraftRecord;
  }

  const items = await readCollection<DraftRecord>("drafts");
  if (input.id) {
    const idx = items.findIndex((d) => d.id === input.id && d.user_key === input.userKey);
    if (idx >= 0) {
      items[idx] = { ...items[idx], data: input.data, updated_at: now };
      await writeCollection("drafts", items);
      return items[idx];
    }
  }
  const record: DraftRecord = { id: randomUUID(), user_key: input.userKey, data: input.data, updated_at: now };
  items.push(record);
  await writeCollection("drafts", items);
  return record;
}

export async function deleteDraft(id: string, userKey: string): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("drafts").delete().eq("id", id).eq("user_key", userKey);
    return;
  }
  const items = await readCollection<DraftRecord>("drafts");
  const next = items.filter((d) => !(d.id === id && d.user_key === userKey));
  await writeCollection("drafts", next);
}
