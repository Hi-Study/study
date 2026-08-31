import { supabase } from "@/lib/supabase";
import { listArticlesFeed } from "../articles";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

/** 체이닝 가능한 thenable 쿼리 빌더 목업. order 로 넘어온 컬럼명을 기록한다. */
function mockQuery(result: { data: unknown; error: unknown }, orders: string[]) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "limit", "or", "not", "overlaps"]) {
    builder[m] = jest.fn(() => builder);
  }
  builder.order = jest.fn((col: string) => {
    orders.push(col);
    return builder;
  });
  (builder as { then: unknown }).then = (resolve: (r: unknown) => void) => resolve(result);
  return builder;
}

beforeEach(() => from.mockReset());

describe("listArticlesFeed 인기순 정렬", () => {
  it("조회수 → 좋아요 → 인사이트수 → 최신 순으로 정렬한다", async () => {
    const orders: string[] = [];
    from.mockReturnValue(mockQuery({ data: [], error: null }, orders));

    await listArticlesFeed(null, { sort: "popular" });

    expect(orders).toEqual(["view_count", "like_count", "opinion_count", "published_at", "id"]);
  });

  it("§21 컬럼이 없는 DB(42703)면 좋아요·최신순으로 한 번 더 시도한다", async () => {
    const attempts: string[][] = [];
    from.mockImplementation(() => {
      const orders: string[] = [];
      attempts.push(orders);
      // 첫 시도: view_count 없음 → 두 번째 시도: 정상 응답
      return attempts.length === 1
        ? mockQuery(
            { data: null, error: { code: "42703", message: 'column articles.view_count does not exist' } },
            orders,
          )
        : mockQuery({ data: [{ id: "a1" }], error: null }, orders);
    });

    const res = await listArticlesFeed(null, { sort: "popular" });

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(["like_count", "published_at", "id"]);
    expect(res.rows).toHaveLength(1);
  });

  it("컬럼 없음이 아닌 에러는 그대로 throw 한다", async () => {
    const orders: string[] = [];
    from.mockReturnValue(mockQuery({ data: null, error: new Error("네트워크 실패") }, orders));

    await expect(listArticlesFeed(null, { sort: "popular" })).rejects.toThrow("네트워크 실패");
  });

  it("최신순은 published_at·id 로만 정렬한다", async () => {
    const orders: string[] = [];
    from.mockReturnValue(mockQuery({ data: [], error: null }, orders));

    await listArticlesFeed(null, {});

    expect(orders).toEqual(["published_at", "id"]);
  });
});
