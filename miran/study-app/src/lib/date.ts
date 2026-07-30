/**
 * 날짜 유틸(순수 함수, 로컬 타임존 기준). 달력/이번 주 화면에서 사용.
 * DB 의 shared_date 는 'YYYY-MM-DD' 문자열.
 */

const WD = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 로컬 날짜 → 'YYYY-MM-DD' (UTC 변환 없이). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → 로컬 Date(자정). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** 그 주의 월요일(주 시작). */
export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (r.getDay() + 6) % 7; // 월요일=0 기준 경과일
  return addDays(r, -diff);
}

/** 월=0 … 일=6 (DB day_of_week 규칙과 동일). */
export function weekdayMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** 요일 한글 한 글자(일~토). getDay() 기준. */
export function krWeekday(d: Date): string {
  return WD[d.getDay()];
}

/** "M월 D일 (요일)". */
export function formatMonthDay(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${krWeekday(d)})`;
}

/** 해당 월의 ISO 범위 [1일, 말일]. */
export function monthRangeISO(year: number, monthIndex: number): {
  start: string;
  end: string;
} {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

/**
 * 달력 그리드용 셀 배열(일요일 시작). 앞뒤 패딩은 null.
 * 각 셀은 Date 또는 null.
 */
export function monthGrid(year: number, monthIndex: number): (Date | null)[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay(); // 일=0
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** "M월 X째 주" 라벨(그 날짜 기준). */
export function weekOfMonthLabel(d: Date): string {
  const ord = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];
  const n = Math.ceil(d.getDate() / 7);
  return `${d.getMonth() + 1}월 ${ord[n - 1] ?? `${n}째`} 주`;
}

/** 필터용 날짜 범위 키 → shared_date 범위(from~to, ISO). all 이면 빈 객체. */
export function dateRangeFor(
  key: "all" | "week" | "month",
  today: Date,
): { from?: string; to?: string } {
  if (key === "week") {
    const mon = mondayOf(today);
    return { from: toISODate(mon), to: toISODate(addDays(mon, 6)) };
  }
  if (key === "month") {
    const { start, end } = monthRangeISO(today.getFullYear(), today.getMonth());
    return { from: start, to: end };
  }
  return {};
}

/** 이번 주 월~일 7개 날짜. */
export function currentWeekDates(today: Date): Date[] {
  const mon = mondayOf(today);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** 토론 생성 시 주차 선택 옵션(월요일 기준). before 주 전부터 count 개. */
export function weekOptions(
  today: Date,
  before = 2,
  count = 5,
): { label: string; weekStartISO: string }[] {
  const base = mondayOf(today);
  return Array.from({ length: count }, (_, i) => {
    const mon = addDays(base, (i - before) * 7);
    return { label: weekOfMonthLabel(mon), weekStartISO: toISODate(mon) };
  });
}

/** 상대 시간 표기("방금"/"N분 전"/"N시간 전"/"N일 전"/날짜). */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - then);
  const MIN = 60_000;
  const HR = 3_600_000;
  const DAY = 86_400_000;
  if (diff < MIN) return "방금";
  if (diff < HR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HR)}시간 전`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export const WEEKDAY_LABELS = WD;
