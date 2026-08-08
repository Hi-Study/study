"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DraftRow } from "@/lib/types";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const inviteCode = String(formData.get("inviteCode") || "").trim();

  if (!email || !inviteCode) {
    return { error: "이메일과 초대 코드를 모두 입력해주세요." };
  }

  const supabase = await createClient();

  const { data: invite, error: inviteError } = await supabase
    .from("invite_codes")
    .select("code")
    .eq("code", inviteCode)
    .maybeSingle();

  if (inviteError || !invite) {
    return { error: "유효하지 않은 초대 코드예요." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: "로그인 링크를 보내는 데 실패했어요. 다시 시도해주세요." };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function toggleBookmark(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("bookmarks").insert({ post_id: postId, user_id: user.id });
  }

  revalidatePath("/home");
  revalidatePath("/search");
  revalidatePath("/my");
  revalidatePath(`/post/${postId}`);
}

export async function toggleTalk(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("talks")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("talks").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("talks").insert({ post_id: postId, user_id: user.id });
  }

  revalidatePath("/home");
  revalidatePath("/my");
  revalidatePath(`/post/${postId}`);
}

export async function addComment(highlightId: string, postId: string, text: string) {
  if (!text.trim()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("comments").insert({
    highlight_id: highlightId,
    user_id: user.id,
    text: text.trim(),
  });

  revalidatePath(`/post/${postId}`);
  revalidatePath(`/post/${postId}/comments`);
}

export async function markNotificationRead(id: string, postId: string | null) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (postId) redirect(`/post/${postId}`);
  revalidatePath("/notifications");
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath("/home");
  redirect("/home");
}

type DraftInput = {
  id?: string;
  title: string;
  source: string;
  url?: string | null;
  step: number;
  paragraphs: string[];
  highlights: DraftRow["highlights"];
  comments: DraftRow["comments"];
  reasonForm: DraftRow["reason_form"];
  tags: string[];
};

export async function saveDraft(input: DraftInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const row = {
    user_id: user.id,
    title: input.title,
    source: input.source,
    url: input.url ?? null,
    step: input.step,
    paragraphs: input.paragraphs,
    highlights: input.highlights,
    comments: input.comments,
    reason_form: input.reasonForm,
    tags: input.tags,
    updated_at: new Date().toISOString(),
  };

  let draftId = input.id;
  if (draftId) {
    await supabase.from("drafts").update(row).eq("id", draftId).eq("user_id", user.id);
  } else {
    const { data } = await supabase.from("drafts").insert(row).select("id").single();
    draftId = data?.id;
  }

  revalidatePath("/my");
  return { id: draftId };
}

export async function publishDraft(input: DraftInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요." };

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      title: input.title,
      source: input.source,
      url: input.url ?? null,
      sharer_id: user.id,
      icon: "link",
      tags: input.tags.length ? input.tags : ["프로덕트"],
      paragraphs: input.paragraphs,
      ai_summary: "이 글의 리더가 남긴 하이라이트를 중심으로 정리한 글이에요.",
      terms: [],
      reader_take: {
        author: user.id,
        thoughts: input.reasonForm.thoughts,
        apply: input.reasonForm.apply,
        other: input.reasonForm.other,
      },
    })
    .select("id")
    .single();

  if (error || !post) {
    return { error: "게시에 실패했어요. 다시 시도해주세요." };
  }

  const highlightIdMap = new Map<string, string>();
  for (const h of input.highlights) {
    const { data: hRow } = await supabase
      .from("highlights")
      .insert({ post_id: post.id, owner_id: user.id, para_idx: h.paraIdx, text: h.text })
      .select("id")
      .single();
    if (hRow) highlightIdMap.set(h.id, hRow.id);
  }

  const impressiveIds = input.highlights.map((h) => highlightIdMap.get(h.id)).filter(Boolean);
  await supabase
    .from("posts")
    .update({ reader_take: { author: user.id, impressive: impressiveIds, ...input.reasonForm } })
    .eq("id", post.id);

  for (const [draftHlId, realHlId] of highlightIdMap.entries()) {
    const comments = input.comments[draftHlId] || [];
    for (const c of comments) {
      await supabase.from("comments").insert({ highlight_id: realHlId, user_id: user.id, text: c.text });
    }
  }

  if (input.id) {
    await supabase.from("drafts").delete().eq("id", input.id).eq("user_id", user.id);
  }

  revalidatePath("/home");
  revalidatePath("/my");
  redirect("/home");
}

export async function deleteDraft(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("drafts").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/my");
}
