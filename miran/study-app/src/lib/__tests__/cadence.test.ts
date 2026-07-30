import { cadenceWeeklyTarget } from "../cadence";

describe("cadenceWeeklyTarget", () => {
  it("'매일 1회' → 7", () => {
    expect(cadenceWeeklyTarget("매일 1회")).toBe(7);
  });
  it("'주 2회' → 2, '주 5회' → 5", () => {
    expect(cadenceWeeklyTarget("주 2회")).toBe(2);
    expect(cadenceWeeklyTarget("주 5회")).toBe(5);
  });
  it("알 수 없는 값 → 기본 2", () => {
    expect(cadenceWeeklyTarget("")).toBe(2);
    expect(cadenceWeeklyTarget(null)).toBe(2);
    expect(cadenceWeeklyTarget("이상한값")).toBe(2);
  });
});
