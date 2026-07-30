import { sanitizeInviteCode } from "../invite";

describe("sanitizeInviteCode", () => {
  it("소문자를 대문자로", () => {
    expect(sanitizeInviteCode("k7f2qx")).toBe("K7F2QX");
  });
  it("영숫자가 아닌 문자 제거(공백·기호·한글)", () => {
    expect(sanitizeInviteCode("K7-F2 QX!")).toBe("K7F2QX");
    expect(sanitizeInviteCode("코드K7F2")).toBe("K7F2");
  });
  it("최대 6자로 자름", () => {
    expect(sanitizeInviteCode("ABCDEFGH")).toBe("ABCDEF");
  });
  it("빈 입력 → 빈 문자열", () => {
    expect(sanitizeInviteCode("")).toBe("");
  });
});
