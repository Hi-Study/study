// 마이 목록을 날짜별로 묶기 위한 버킷 라벨. 순수 함수(now 주입 — 테스트 가능).
export function dateBucket(iso: string | null | undefined, now: number): string {
  if (!iso) return "기타";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "기타";
  const days = Math.floor((now - t) / 86400000);
  if (days <= 0) return "오늘";
  if (days < 7) return "최근 7일";
  if (days < 30) return "최근 30일";
  return "이전";
}

/**
 * 이미 날짜 내림차순으로 정렬된 목록에서, 각 항목 위에 표시할 "구간 헤더"를 계산한다.
 * 버킷이 바뀌는 첫 항목에만 라벨, 나머지는 null.
 */
export function bucketHeaders(dates: (string | null | undefined)[], now: number): (string | null)[] {
  let prev: string | null = null;
  return dates.map((d) => {
    const b = dateBucket(d, now);
    if (b === prev) return null;
    prev = b;
    return b;
  });
}
