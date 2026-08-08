import Link from "next/link";
import { getInsightFeed } from "@/lib/queries";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const firstAnswer = (r: { q1: string; q2: string; q3: string }) => r.q1?.trim() || r.q2?.trim() || r.q3?.trim() || "";

export default async function InsightPage() {
  const reviews = await getInsightFeed();
  return (
    <>
      <div className="appbar"><span className="title">인사이트</span></div>
      <div className="pad">
        <div className="subhead">인사이터들이 남긴 독후감을 최신순으로 만나보세요</div>
        {reviews.length ? (
          reviews.map((r) => (
            <Link key={r.id} href={`/posts/${r.post_id}`} className="review">
              <div className="who">
                <span className="avatar md">{r.author?.initial ?? "?"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{r.author?.name ?? "인사이터"}</div>
                  <div className="meta mono">{new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-sub)", margin: "2px 0 8px" }}>{r.post?.title}</div>
              <div className="rq"><div className="a">{firstAnswer(r)}</div></div>
              <div className="foot"><span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="comment" size="sm" /> 댓글 {r.comment_count ?? 0}</span></div>
            </Link>
          ))
        ) : (
          <div className="empty"><div className="art" /><div className="msg">첫 독후감을 남겨보세요</div></div>
        )}
      </div>
    </>
  );
}
