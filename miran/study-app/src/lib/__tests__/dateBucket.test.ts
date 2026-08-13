import { bucketHeaders, dateBucket } from "@/lib/dateBucket";

const NOW = new Date("2026-08-13T00:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

describe("dateBucket", () => {
  it("오늘/최근7일/최근30일/이전으로 나눈다", () => {
    expect(dateBucket(daysAgo(0), NOW)).toBe("오늘");
    expect(dateBucket(daysAgo(3), NOW)).toBe("최근 7일");
    expect(dateBucket(daysAgo(20), NOW)).toBe("최근 30일");
    expect(dateBucket(daysAgo(100), NOW)).toBe("이전");
  });
  it("빈 값·잘못된 날짜는 기타", () => {
    expect(dateBucket(null, NOW)).toBe("기타");
    expect(dateBucket("nope", NOW)).toBe("기타");
  });
});

describe("bucketHeaders", () => {
  it("버킷이 바뀌는 첫 항목에만 라벨", () => {
    const dates = [daysAgo(0), daysAgo(0), daysAgo(3), daysAgo(40)];
    expect(bucketHeaders(dates, NOW)).toEqual(["오늘", null, "최근 7일", "이전"]);
  });
});
