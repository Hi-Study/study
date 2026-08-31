"use client";

// 마이 상단: 좌측 이번 달 인사이트 수 + 우측 캘린더(인사이트 남긴 날 표시)
export default function MyHeader({ insightDates }: { insightDates: string[] }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const marked = new Set<number>();
  let monthCount = 0;
  insightDates.forEach((iso) => {
    const d = new Date(iso);
    if (d.getFullYear() === y && d.getMonth() === m) { marked.add(d.getDate()); monthCount++; }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="my-head">
      <div className="mh-count-box">
        <div className="mh-label">이번 달 인사이트</div>
        <div className="mh-count">{monthCount}<span className="mh-unit">개</span></div>
      </div>
      <div className="cal">
        <div className="cal-title">{y}. {String(m + 1).padStart(2, "0")}</div>
        <div className="cal-grid">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => <span key={w} className="cal-w">{w}</span>)}
          {cells.map((d, i) =>
            d === null
              ? <span key={i} />
              : <span key={i} className={`cal-d${d === today ? " today" : ""}${marked.has(d) ? " on" : ""}`}>{d}</span>
          )}
        </div>
      </div>
    </div>
  );
}
