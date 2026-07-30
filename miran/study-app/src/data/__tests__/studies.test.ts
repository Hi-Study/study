/**
 * 연결 검증 예시 — 화면이 부르는 data 함수가 Supabase 를 올바른 이름·인자로
 * 호출하는지, 에러를 제대로 전파하는지 mock 으로 검증한다.
 */
import { supabase } from "@/lib/supabase";
import {
  createStudy,
  joinByCode,
  deleteStudy,
  regenerateInviteCode,
} from "../studies";

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

const rpc = supabase.rpc as unknown as jest.Mock;
const from = supabase.from as unknown as jest.Mock;

function chain(result: { data?: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["delete", "eq", "select", "single"]) b[m] = jest.fn(() => b);
  (b as { then: unknown }).then = (resolve: (r: unknown) => void) => resolve(result);
  return b;
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("createStudy", () => {
  it("create_study RPC 를 정확한 인자로 호출하고 study id 를 반환", async () => {
    rpc.mockResolvedValue({ data: "study-123", error: null });

    const id = await createStudy({ name: "기획 뜯어보기", description: "설명", cadence: "주 3회" });

    expect(rpc).toHaveBeenCalledWith("create_study", {
      _name: "기획 뜯어보기",
      _description: "설명",
      _cadence: "주 3회",
    });
    expect(id).toBe("study-123");
  });

  it("cadence 미지정 시 기본 '주 2회'", async () => {
    rpc.mockResolvedValue({ data: "s1", error: null });
    await createStudy({ name: "A" });
    expect(rpc).toHaveBeenCalledWith("create_study", {
      _name: "A",
      _description: null,
      _cadence: "주 2회",
    });
  });

  it("에러 발생 시 throw", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("실패") });
    await expect(createStudy({ name: "A" })).rejects.toThrow("실패");
  });
});

describe("joinByCode", () => {
  it("join_by_code RPC 결과를 그대로 반환", async () => {
    rpc.mockResolvedValue({
      data: { status: "joined", study_id: "s9" },
      error: null,
    });
    const res = await joinByCode("K7F2QX");
    expect(rpc).toHaveBeenCalledWith("join_by_code", { _code: "K7F2QX" });
    expect(res).toEqual({ status: "joined", study_id: "s9" });
  });
});

describe("regenerateInviteCode", () => {
  it("regenerate_invite_code RPC 를 호출하고 새 코드를 반환", async () => {
    rpc.mockResolvedValue({ data: "NEWCOD", error: null });
    const code = await regenerateInviteCode("s1");
    expect(rpc).toHaveBeenCalledWith("regenerate_invite_code", { _study: "s1" });
    expect(code).toBe("NEWCOD");
  });
});

describe("deleteStudy", () => {
  it("studies 를 id 로 삭제한다", async () => {
    const b = chain({ error: null });
    from.mockReturnValue(b);
    await deleteStudy("s1");
    expect(from).toHaveBeenCalledWith("studies");
    expect(b.delete).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("에러 발생 시 throw", async () => {
    from.mockReturnValue(chain({ error: new Error("삭제 실패") }));
    await expect(deleteStudy("s1")).rejects.toThrow("삭제 실패");
  });
});
