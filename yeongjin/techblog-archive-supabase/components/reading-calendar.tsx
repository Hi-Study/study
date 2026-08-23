const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 이번 달 읽은 날짜를 표시하는 미니 캘린더 — 사락의 "독서 목표" 카드 옆 달력 자리를
// 실제 읽음(reads) 기록 기반 활동 캘린더로 대체했다(가짜 목표 수치를 만들 수 없어서).
export function ReadingCalendar({ activeDates }: { activeDates: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(year, month, now.getDate());

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p className="text-sm font-semibold">{month + 1}월</p>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const key = toDateKey(year, month, day);
          const active = activeDates.has(key);
          const isToday = key === todayKey;
          return (
            <span
              key={key}
              className={
                active
                  ? "mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                  : isToday
                    ? "mx-auto flex h-5 w-5 items-center justify-center rounded-full border border-primary"
                    : "text-muted-foreground"
              }
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
