import { supabase } from "@/lib/supabase";
import { createComment } from "../comments";

jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

function chain(result: { data: unknown; error: unknown }) {
  const b: Record<string, jest.Mock> = {};
  for (const m of ["insert", "select", "eq", "order"]) b[m] = jest.fn(() => b);
  b.single = jest.fn(() => Promise.resolve(result));
  return b;
}

beforeEach(() => from.mockReset());

describe("createComment", () => {
  it("study_id·target·author·parent·quote 를 담아 insert 한다", async () => {
    const row = { id: "c1", text: "좋은 글이네요" };
    const b = chain({ data: row, error: null });
    from.mockReturnValue(b);

    const res = await createComment("user-1", {
      studyId: "s1",
      targetType: "share",
      targetId: "share-9",
      text: "좋은 글이네요",
      parentId: "c0",
      quote: "원문 인용",
    });

    expect(from).toHaveBeenCalledWith("comments");
    expect(b.insert).toHaveBeenCalledWith({
      study_id: "s1",
      target_type: "share",
      target_id: "share-9",
      author_id: "user-1",
      text: "좋은 글이네요",
      parent_id: "c0",
      quote: "원문 인용",
    });
    expect(res).toEqual(row);
  });

  it("parent/quote 미지정 시 null 로 insert", async () => {
    const b = chain({ data: { id: "c2" }, error: null });
    from.mockReturnValue(b);
    await createComment("user-1", {
      studyId: "s1",
      targetType: "discussion",
      targetId: "d1",
      text: "의견",
    });
    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: null, quote: null }),
    );
  });
});
