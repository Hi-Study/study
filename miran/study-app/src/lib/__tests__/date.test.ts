import {
  addDays,
  currentWeekDates,
  formatMonthDay,
  fromISODate,
  mondayOf,
  monthGrid,
  monthRangeISO,
  timeAgo,
  toISODate,
  weekdayMonFirst,
  weekOfMonthLabel,
  weekOptions,
} from "../date";

describe("toISODate / fromISODate", () => {
  it("로컬 날짜를 YYYY-MM-DD 로 변환(자릿수 패딩)", () => {
    expect(toISODate(new Date(2026, 6, 5))).toBe("2026-07-05");
  });
  it("왕복 변환이 일치", () => {
    const iso = "2026-07-21";
    expect(toISODate(fromISODate(iso))).toBe(iso);
  });
});

describe("mondayOf", () => {
  it("화요일(2026-07-21)의 주 시작은 월요일 2026-07-20", () => {
    expect(toISODate(mondayOf(new Date(2026, 6, 21)))).toBe("2026-07-20");
  });
  it("일요일도 직전 월요일로", () => {
    // 2026-07-26 는 일요일 → 같은 주 월요일 2026-07-20
    expect(toISODate(mondayOf(new Date(2026, 6, 26)))).toBe("2026-07-20");
  });
});

describe("weekdayMonFirst", () => {
  it("월=0 … 일=6", () => {
    expect(weekdayMonFirst(new Date(2026, 6, 20))).toBe(0); // 월
    expect(weekdayMonFirst(new Date(2026, 6, 21))).toBe(1); // 화
    expect(weekdayMonFirst(new Date(2026, 6, 26))).toBe(6); // 일
  });
});

describe("addDays / currentWeekDates", () => {
  it("addDays 는 월 경계를 넘긴다", () => {
    expect(toISODate(addDays(new Date(2026, 6, 31), 1))).toBe("2026-08-01");
  });
  it("이번 주는 월요일부터 7일", () => {
    const week = currentWeekDates(new Date(2026, 6, 22)); // 수요일
    expect(week.map(toISODate)).toEqual([
      "2026-07-20", "2026-07-21", "2026-07-22",
      "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26",
    ]);
  });
});

describe("monthRangeISO", () => {
  it("2026년 7월 → 1일~31일", () => {
    expect(monthRangeISO(2026, 6)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
  it("2월(윤년 아님) → 28일", () => {
    expect(monthRangeISO(2026, 1).end).toBe("2026-02-28");
  });
});

describe("monthGrid", () => {
  it("7의 배수 길이이며 1일 앞에 요일만큼 null 패딩", () => {
    const cells = monthGrid(2026, 6); // 2026-07-01 은 수요일(getDay()=3)
    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 3).every((c) => c === null)).toBe(true);
    expect(cells[3] && toISODate(cells[3])).toBe("2026-07-01");
  });
});

describe("formatMonthDay", () => {
  it("'M월 D일 (요일)' 형식", () => {
    expect(formatMonthDay(new Date(2026, 6, 21))).toBe("7월 21일 (화)");
  });
});

describe("weekOfMonthLabel", () => {
  it("'M월 X째 주' 형식", () => {
    expect(weekOfMonthLabel(new Date(2026, 6, 20))).toBe("7월 셋째 주");
    expect(weekOfMonthLabel(new Date(2026, 6, 1))).toBe("7월 첫째 주");
  });
});

describe("weekOptions", () => {
  it("count 개를 반환하고 before 인덱스가 이번 주", () => {
    const opts = weekOptions(new Date(2026, 6, 22), 2, 5); // 수요일, 이번주 월=07-20
    expect(opts).toHaveLength(5);
    expect(opts[2]).toEqual({ label: "7월 셋째 주", weekStartISO: "2026-07-20" });
    expect(opts[3].weekStartISO).toBe("2026-07-27");
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 6, 21, 12, 0, 0);
  const iso = (d: Date) => d.toISOString();
  it("1분 미만 → '방금'", () => {
    expect(timeAgo(iso(new Date(2026, 6, 21, 11, 59, 30)), now)).toBe("방금");
  });
  it("분/시간/일 단위", () => {
    expect(timeAgo(iso(new Date(2026, 6, 21, 11, 30, 0)), now)).toBe("30분 전");
    expect(timeAgo(iso(new Date(2026, 6, 21, 9, 0, 0)), now)).toBe("3시간 전");
    expect(timeAgo(iso(new Date(2026, 6, 19, 12, 0, 0)), now)).toBe("2일 전");
  });
  it("미래 시각은 '방금'으로 보정", () => {
    expect(timeAgo(iso(new Date(2026, 6, 21, 12, 5, 0)), now)).toBe("방금");
  });
});
