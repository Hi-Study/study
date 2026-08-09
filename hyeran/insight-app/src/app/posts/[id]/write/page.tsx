import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import ReviewForm from "./review-form";

export const dynamic = "force-dynamic";

export default async function WriteReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const [postRes, mine] = await Promise.all([
    sb.from("posts").select("title, category, company:companies(name, domain)").eq("id", id).single(),
    sb.from("reviews").select("q1, q2, q3").eq("post_id", id).eq("author_id", user!.id).maybeSingle(),
  ]);
  const post = postRes.data as { title: string; company?: { name: string; domain: string } | null } | null;
  if (!post) notFound();
  const initial: [string, string, string] = [mine.data?.q1 ?? "", mine.data?.q2 ?? "", mine.data?.q3 ?? ""];

  return (
    <div className="screen">
      <div className="appbar">
        <BackButton />
        <span className="title" style={{ fontSize: 17 }}>독후감 쓰기</span>
      </div>
      <div className="pad">
        <div className="card" style={{ borderLeft: "none", borderRadius: "var(--r-card)" }}>
          <div className="meta mono">{post.company?.domain}</div>
          <h3 style={{ marginTop: 5 }}>{post.title}</h3>
        </div>
      </div>
      <ReviewForm postId={id} initial={initial} />
    </div>
  );
}
