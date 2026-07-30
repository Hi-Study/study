import { supabase } from "@/lib/supabase";
import { listDiscussionsWithMeta } from "../discussions";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

function chain(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lte", "ilike", "order", "in"]) {
    b[m] = jest.fn(() => b);
  }
  (b as { then: unknown }).then = (resolve: (r: unknown) => void) => resolve(result);
  return b;
}

beforeEach(() => from.mockReset());

describe("listDiscussionsWithMeta", () => {
  it("답글 수와 내 참여 여부를 계산한다", async () => {
    from
      .mockReturnValueOnce(
        chain({
          data: [
            { id: "d1", is_active: true, week_label: "7월 셋째 주" },
            { id: "d2", is_active: false, week_label: "7월 둘째 주" },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        chain({
          data: [
            { target_id: "d1", author_id: "me" },
            { target_id: "d1", author_id: "other" },
            { target_id: "d2", author_id: "other" },
          ],
          error: null,
        }),
      );

    const res = await listDiscussionsWithMeta(
      "s1",
      { monthStart: "2026-07-01", monthEnd: "2026-07-31" },
      "me",
    );

    expect(res[0]).toMatchObject({ id: "d1", commentCount: 2, participated: true });
    expect(res[1]).toMatchObject({ id: "d2", commentCount: 1, participated: false });
  });

  it("토론이 없으면 빈 배열(댓글 조회 스킵)", async () => {
    from.mockReturnValueOnce(chain({ data: [], error: null }));
    const res = await listDiscussionsWithMeta(
      "s1",
      { monthStart: "2026-07-01", monthEnd: "2026-07-31" },
      "me",
    );
    expect(res).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1); // comments 쿼리는 실행 안 됨
  });
});
