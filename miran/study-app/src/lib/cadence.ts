/**
 * 공유 주기 문자열 → 주당 목표 횟수. (dev/schema.md: 매일 1회 / 주 2회 / 주 3회 / 주 5회)
 * "공유 주기 미달" 판정·표시에 사용.
 */
export function cadenceWeeklyTarget(cadence: string | null | undefined): number {
  const c = (cadence ?? "").trim();
  if (c.includes("매일")) return 7;
  const m = c.match(/(\d+)\s*회/);
  return m ? Number(m[1]) : 2; // 기본값 주 2회
}

/** 선택 가능한 주기 옵션(Members 화면 칩). */
export const CADENCE_OPTIONS = ["매일 1회", "주 2회", "주 3회", "주 5회"] as const;
