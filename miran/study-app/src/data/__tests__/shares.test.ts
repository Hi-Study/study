import { supabase } from "@/lib/supabase";
import { listShareDatesInRange } from "../shares";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

/** 체이닝 가능한 thenable 쿼리 빌더 목업. */
function mockQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "in", "order"]) {
    builder[m] = jest.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (r: unknown) => void) =>
    resolve(result);
  return builder;
}

beforeEach(() => from.mockReset());

describe("listShareDatesInRange", () => {
  it("날짜별 공유 글 개수를 집계한다", async () => {
    from.mockReturnValue(
      mockQuery({
        data: [
          { shared_date: "2026-07-20" },
          { shared_date: "2026-07-20" },
          { shared_date: "2026-07-21" },
        ],
        error: null,
      }),
    );

    const counts = await listShareDatesInRange("s1", "2026-07-01", "2026-07-31");

    expect(from).toHaveBeenCalledWith("shares");
    expect(counts).toEqual({ "2026-07-20": 2, "2026-07-21": 1 });
  });

  it("에러 발생 시 throw", async () => {
    from.mockReturnValue(mockQuery({ data: null, error: new Error("range 실패") }));
    await expect(
      listShareDatesInRange("s1", "2026-07-01", "2026-07-31"),
    ).rejects.toThrow("range 실패");
  });
});
