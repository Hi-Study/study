import { supabase } from "@/lib/supabase";
import { listOpinionsFeed } from "../opinions";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

function mockQuery(result: { data: unknown; error: unknown }, orders: string[]) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "limit"]) {
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

describe("listOpinionsFeed", () => {
  it("인기순은 like_count 로 정렬한다", async () => {
    const orders: string[] = [];
    from.mockReturnValue(mockQuery({ data: [], error: null }, orders));

    await listOpinionsFeed("popular");

    expect(orders).toEqual(["like_count", "created_at"]);
  });

  it("like_count 컬럼이 없는 DB(42703)면 최신순으로 폴백한다", async () => {
    const attempts: string[][] = [];
    from.mockImplementation(() => {
      const orders: string[] = [];
      attempts.push(orders);
      return attempts.length === 1
        ? mockQuery(
            { data: null, error: { code: "42703", message: "column opinions.like_count does not exist" } },
            orders,
          )
        : mockQuery({ data: [{ id: "o1" }], error: null }, orders);
    });

    const rows = await listOpinionsFeed("popular");

    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(["created_at"]);
    expect(rows).toHaveLength(1);
  });
});
