// 태그 집계 — 여러 글의 태그 배열에서 가장 많이 등장한 상위 N개(인기 키워드). 순수 함수.
export function topTags(tagLists: (string[] | null | undefined)[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const t of tags ?? []) {
      const k = t.trim();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}
