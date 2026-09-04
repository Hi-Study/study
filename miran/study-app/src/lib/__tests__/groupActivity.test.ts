import { groupActivity } from "@/lib/groupActivity";

interface Row {
  id: string;
  article_id: string | null;
  created_at: string;
}
const r = (id: string, article_id: string | null, created_at: string): Row => ({
  id,
  article_id,
  created_at,
});

const group = (rows: Row[]) =>
  groupActivity(
    rows,
    (x) => x.article_id,
    (x) => x.created_at,
  );

describe("groupActivity — 같은 글의 활동을 한 카드로", () => {
  it("같은 글의 하이라이트를 하나로 묶는다", () => {
    const g = group([
      r("h1", "A", "2026-09-03T10:00:00Z"),
      r("h2", "A", "2026-09-03T09:00:00Z"),
      r("h3", "B", "2026-09-02T10:00:00Z"),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].key).toBe("A");
    expect(g[0].items.map((x) => x.id)).toEqual(["h1", "h2"]);
    expect(g[1].key).toBe("B");
  });

  it("그룹은 가장 최근 활동순", () => {
    // B 가 먼저 나오지만 A 에 더 최근 활동이 있으면 A 가 앞선다.
    const g = group([
      r("h1", "B", "2026-09-01T10:00:00Z"),
      r("h2", "A", "2026-09-05T10:00:00Z"),
    ]);
    expect(g.map((x) => x.key)).toEqual(["A", "B"]);
  });

  it("그룹의 latest 는 가장 최근 시각", () => {
    const g = group([
      r("h1", "A", "2026-09-01T10:00:00Z"),
      r("h2", "A", "2026-09-07T10:00:00Z"),
    ]);
    expect(g[0].latest).toBe("2026-09-07T10:00:00Z");
  });

  it("안쪽 순서는 원본 그대로(최신 먼저) 유지", () => {
    const g = group([
      r("h1", "A", "2026-09-03T10:00:00Z"),
      r("h2", "A", "2026-09-02T10:00:00Z"),
      r("h3", "A", "2026-09-01T10:00:00Z"),
    ]);
    expect(g[0].items.map((x) => x.id)).toEqual(["h1", "h2", "h3"]);
  });

  it("원본을 모르면 묶지 않고 혼자 둔다", () => {
    const g = group([
      r("x1", null, "2026-09-03T10:00:00Z"),
      r("x2", null, "2026-09-02T10:00:00Z"),
    ]);
    expect(g).toHaveLength(2);
    expect(g.every((x) => x.items.length === 1)).toBe(true);
  });

  it("빈 목록은 빈 배열", () => {
    expect(group([])).toEqual([]);
  });

  it("날짜가 없어도 죽지 않는다", () => {
    const g = groupActivity(
      [{ id: "a", article_id: "A", created_at: null as unknown as string }],
      (x) => x.article_id,
      (x) => x.created_at,
    );
    expect(g).toHaveLength(1);
    expect(g[0].latest).toBeNull();
  });
});
