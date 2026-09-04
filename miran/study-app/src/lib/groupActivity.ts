// 마이 활동을 **원본(글) 단위로 묶는다.**
//
// 왜: 한 글에 밑줄을 5개 그으면 마이 > 하이라이트에 카드가 5장 생겼다. 같은 글인데
// 다섯 번 나오니 목록이 길어지기만 하고, "내가 어떤 글을 읽었나"가 안 보인다.
// 단어장·댓글도 같은 문제다(한 글에서 단어 4개를 담으면 카드 4장).
//
// 묶는 기준은 원본 id(글·인사이트·자유글)이고, 그룹 순서는 **가장 최근 활동순**이다.
// 안에 든 항목은 원본 순서(최신 먼저)를 그대로 유지한다.

export interface ActivityGroup<T> {
  /** 원본 id. 원본을 알 수 없는 항목은 자기 자신만 담은 그룹이 된다. */
  key: string;
  /** 그룹 안에서 가장 최근 활동 시각 — 그룹 정렬과 날짜 헤더에 쓴다. */
  latest: string | null;
  items: T[];
}

const time = (v: string | null | undefined): number => {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * @param rows    최신순으로 정렬된 활동 목록
 * @param keyOf   원본 id(글 id 등). null 이면 묶지 않는다.
 * @param dateOf  활동 시각
 */
export function groupActivity<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  dateOf: (row: T) => string | null | undefined,
): ActivityGroup<T>[] {
  const byKey = new Map<string, ActivityGroup<T>>();
  const loose: ActivityGroup<T>[] = [];

  rows.forEach((row, i) => {
    const k = keyOf(row);
    const at = dateOf(row) ?? null;
    if (!k) {
      // 원본을 모르면 묶을 수 없다 — 혼자 있는 그룹으로 둔다.
      loose.push({ key: `__loose_${i}`, latest: at, items: [row] });
      return;
    }
    const g = byKey.get(k);
    if (g) {
      g.items.push(row);
      if (time(at) > time(g.latest)) g.latest = at;
    } else {
      byKey.set(k, { key: k, latest: at, items: [row] });
    }
  });

  return [...byKey.values(), ...loose].sort((a, b) => time(b.latest) - time(a.latest));
}
