import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 토론 참여(가벼운 참여/취소 토글) — v0.1의 "토론 신청"(모집중/진행중/종료 상태)은 2026-08-06
// 회의에서 폐기됐지만, 참여 인원을 보여주고 참여할 수 있는 가벼운 버전만 다시 들여온다.
// 상태 없이 "참여 중이냐 아니냐"만 있고, 별도의 개설/종료 절차는 없다.
export type DiscussionParticipantRecord = {
  id: string;
  article_id: string;
  user_key: string;
  joined_at: string;
};

export async function countParticipantsByArticle(): Promise<Record<string, number>> {
  let items: DiscussionParticipantRecord[];
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("discussion_participants").select("article_id");
    items = (data as DiscussionParticipantRecord[]) ?? [];
  } else {
    items = await readCollection<DiscussionParticipantRecord>("discussion_participants");
  }
  const counts: Record<string, number> = {};
  for (const p of items) counts[p.article_id] = (counts[p.article_id] ?? 0) + 1;
  return counts;
}

export async function listParticipatingArticleIds(userKey: string): Promise<Set<string>> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("discussion_participants")
      .select("article_id")
      .eq("user_key", userKey);
    return new Set(((data as DiscussionParticipantRecord[]) ?? []).map((p) => p.article_id));
  }
  const items = await readCollection<DiscussionParticipantRecord>("discussion_participants");
  return new Set(items.filter((p) => p.user_key === userKey).map((p) => p.article_id));
}

export async function toggleParticipant(
  articleId: string,
  userKey: string,
): Promise<{ joined: boolean }> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("discussion_participants")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_key", userKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("discussion_participants").delete().eq("id", existing.id);
      return { joined: false };
    }
    await supabase.from("discussion_participants").insert({ article_id: articleId, user_key: userKey });
    return { joined: true };
  }

  const items = await readCollection<DiscussionParticipantRecord>("discussion_participants");
  const idx = items.findIndex((p) => p.article_id === articleId && p.user_key === userKey);
  if (idx >= 0) {
    items.splice(idx, 1);
    await writeCollection("discussion_participants", items);
    return { joined: false };
  }
  items.push({
    id: randomUUID(),
    article_id: articleId,
    user_key: userKey,
    joined_at: new Date().toISOString(),
  });
  await writeCollection("discussion_participants", items);
  return { joined: true };
}
