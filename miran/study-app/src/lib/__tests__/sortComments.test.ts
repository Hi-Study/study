import { sortComments, threadComments } from "../sortComments";

const c = (id: string, likeCount: number, created_at: string) => ({ id, likeCount, created_at });

const tc = (
  id: string,
  parent_id: string | null,
  likeCount: number,
  created_at: string,
) => ({ id, parent_id, likeCount, created_at });

describe("sortComments", () => {
  const list = [
    c("a", 2, "2026-07-20T10:00:00Z"),
    c("b", 5, "2026-07-20T11:00:00Z"),
    c("c", 5, "2026-07-20T09:00:00Z"),
  ];

  it("'recent'는 입력 순서를 유지", () => {
    expect(sortComments(list, "recent").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("'likes'는 좋아요 내림차순, 동률이면 등록 빠른 순", () => {
    // b,c 는 5개 동률 → 등록 빠른 c 가 먼저
    expect(sortComments(list, "likes").map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const copy = [...list];
    sortComments(list, "likes");
    expect(list).toEqual(copy);
  });
});

describe("threadComments", () => {
  // t1(최상위) - r1(t1 답글), t2(최상위)
  const list = [
    tc("t1", null, 1, "2026-07-20T10:00:00Z"),
    tc("r1", "t1", 0, "2026-07-20T10:05:00Z"),
    tc("t2", null, 5, "2026-07-20T11:00:00Z"),
  ];

  it("답글은 부모 바로 아래 depth=1 로 붙는다(등록순)", () => {
    const out = threadComments(list, "recent");
    expect(out.map((o) => [o.comment.id, o.depth])).toEqual([
      ["t1", 0],
      ["r1", 1],
      ["t2", 0],
    ]);
  });

  it("좋아요순은 최상위만 정렬, 답글은 부모 따라감", () => {
    const out = threadComments(list, "likes");
    // t2(5) > t1(1) → t2 먼저, r1 은 t1 아래
    expect(out.map((o) => o.comment.id)).toEqual(["t2", "t1", "r1"]);
  });

  it("방장 고정 댓글은 최상단", () => {
    const out = threadComments(list, "recent", "t2");
    expect(out[0].comment.id).toBe("t2");
  });

  it("고정이 답글이면 그 답글의 최상위 스레드(부모+답글)가 최상단", () => {
    // r1 은 t1 의 답글 → t1 스레드가 통째로 맨 위
    const out = threadComments(list, "recent", "r1");
    expect(out.map((o) => o.comment.id)).toEqual(["t1", "r1", "t2"]);
  });
});
