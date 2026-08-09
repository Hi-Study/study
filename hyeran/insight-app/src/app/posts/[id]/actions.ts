"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitReview(postId: string, q1: string, q2: string, q3: string) {
  if (![q1, q2, q3].some((x) => x.trim())) return { error: "최소 1개는 작성해야 해요" };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "로그인이 필요해요" };

  const { error } = await sb.from("reviews").upsert(
    { post_id: postId, author_id: user.id, q1: q1.trim(), q2: q2.trim(), q3: q3.trim(), is_draft: false, updated_at: new Date().toISOString() },
    { onConflict: "post_id,author_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/insight");
  return { ok: true };
}
