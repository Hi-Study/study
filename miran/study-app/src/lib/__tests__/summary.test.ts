import { splitInsightSections } from "@/lib/summary";

describe("splitInsightSections (AI 요약 3관점)", () => {
  it("### 제목 기준으로 섹션을 나눈다", () => {
    const t =
      "### 무슨 문제\n문제 내용입니다.\n### 어떻게 해결\n해결 내용.\n### 배울 점\n배울 내용.";
    const s = splitInsightSections(t);
    expect(s.map((x) => x.title)).toEqual(["무슨 문제", "어떻게 해결", "배울 점"]);
    expect(s[0].body).toBe("문제 내용입니다.");
  });

  it("### 마커가 없으면 통째로 한 섹션", () => {
    expect(splitInsightSections("그냥 요약문입니다")).toEqual([
      { title: "AI 요약", body: "그냥 요약문입니다" },
    ]);
  });

  it("빈 값·공백은 빈 배열", () => {
    expect(splitInsightSections("")).toEqual([]);
    expect(splitInsightSections("   ")).toEqual([]);
  });
});
