"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/types";

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

// 직접 등록 글 수정 (본인·direct만; RLS로 이중 보호)
export async function updatePost(
  postId: string,
  fields: { title: string; category: string; tags: string; problem: string; solution: string; learning: string },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "로그인이 필요해요" };
  const title = fields.title.trim();
  if (!title) return { error: "제목을 입력해주세요" };
  const category: Category = CATEGORIES.includes(fields.category as Category) ? (fields.category as Category) : "기술";
  const tags = fields.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6);

  const { error } = await sb.from("posts").update({
    title, category, tags,
    ai_summary: { problem: fields.problem.trim(), solution: fields.solution.trim(), learning: fields.learning.trim() },
  }).eq("id", postId).eq("author_id", user.id);
  if (error) return { error: error.message };

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
  revalidatePath("/feed");
  return { ok: true };
}

// 직접 등록 글 삭제 (본인만)
export async function deletePost(postId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "로그인이 필요해요" };
  const { error } = await sb.from("posts").delete().eq("id", postId).eq("author_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/home");
  revalidatePath("/feed");
  revalidatePath("/insight");
  redirect("/home");
}
