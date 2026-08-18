import { splitInsightSections, isStructuredInsight, INSIGHT_TITLES } from "@/lib/summary";

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

  it("마커가 없어도 표준 제목이 박혀 있으면 그 위치로 분할", () => {
    const t =
      "무슨 문제를 다뤘나 문제 설명. 어떻게 해결했나 해결 설명. 디자이너·PM 관점에서 배울 점 배움 설명.";
    const s = splitInsightSections(t);
    expect(s.length).toBe(3);
    expect(s.map((x) => x.title)).toEqual([...INSIGHT_TITLES]);
    expect(s[0].body).toBe("문제 설명.");
  });

  it("## / # 헤더 변형도 분할한다", () => {
    const t = "## 무슨 문제\n내용A\n## 어떻게 해결\n내용B";
    const s = splitInsightSections(t);
    expect(s.map((x) => x.title)).toEqual(["무슨 문제", "어떻게 해결"]);
  });
});

describe("isStructuredInsight", () => {
  it("### 마커가 있으면 구조화로 판단", () => {
    expect(isStructuredInsight("### 무슨 문제\n내용")).toBe(true);
  });
  it("표준 제목이 2개 이상이면 구조화로 판단", () => {
    expect(isStructuredInsight("무슨 문제를 다뤘나 ... 어떻게 해결했나 ...")).toBe(true);
  });
  it("단일 요약문(구형/폴백)은 비구조화", () => {
    expect(isStructuredInsight("그냥 한 줄 요약입니다")).toBe(false);
    expect(isStructuredInsight("")).toBe(false);
    expect(isStructuredInsight(null)).toBe(false);
  });
});
