import { TrackView } from "@/components/common/TrackView";

/**
 * 글 상세의 정리 영역 공통 틀 — 한눈에 보기 · 읽기 전에 알아두면 좋은 개념 · 읽은 후에 얻어가는 기획 포인트가 같이 쓴다.
 * 바깥 박스(흰 카드) 안에 영문 머리말 → 제목 → 한 줄 안내 → 안쪽 회색 칸들. 안쪽 칸은 DetailItem 으로 맞춘다.
 */
export function DetailCard({
  eyebrow,
  title,
  desc,
  ga,
  children,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  /** GA content_section 값 — 주면 이 영역이 화면에 보일 때 content_section_view 를 보낸다(reading_guide / before_reading / takeaways) */
  ga?: string;
  children: React.ReactNode;
}) {
  const className = "rounded-3xl border border-line bg-surface p-5 md:p-7";
  const body = (
    <>
      <p className="text-xs font-bold tracking-wide text-brand">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-ink-3">{desc}</p>}
      <div className="mt-4">{children}</div>
    </>
  );
  if (!ga) return <section className={className}>{body}</section>;
  return (
    <TrackView event="content_section_view" params={{ content_section: ga }} className={className}>
      {body}
    </TrackView>
  );
}

/** 안쪽 회색 칸 하나 — 칸끼리는 부모에서 grid gap-3 으로 띄운다 */
export function DetailItem({ children, as: Tag = "div" }: { children: React.ReactNode; as?: "div" | "li" }) {
  return <Tag className="rounded-2xl bg-bg p-4">{children}</Tag>;
}

/** 칸 안의 작은 회색 물음 + 본문 — 한눈에 보기의 "무엇을 했대요?" 와 같은 모양 */
export function DetailQA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-ink-3">{q}</dt>
      <dd className="mt-1 leading-relaxed">{children}</dd>
    </div>
  );
}
