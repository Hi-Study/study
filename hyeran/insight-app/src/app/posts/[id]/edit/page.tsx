import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import EditForm from "./edit-form";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("posts").select("*").eq("id", id).single();
  const post = data as Post | null;
  if (!post) notFound();
  // 본인이 직접 등록한 글만 수정 가능
  if (post.source !== "direct" || post.author_id !== user!.id) redirect(`/posts/${id}`);

  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title" style={{ fontSize: 17 }}>글 수정</span></div>
      <EditForm
        postId={post.id}
        init={{
          title: post.title,
          category: post.category,
          tags: post.tags ?? [],
          problem: post.ai_summary?.problem ?? "",
          solution: post.ai_summary?.solution ?? "",
          learning: post.ai_summary?.learning ?? "",
        }}
      />
    </div>
  );
}
