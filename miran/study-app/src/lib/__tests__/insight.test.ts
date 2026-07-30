import { EMPTY_INSIGHT, cleanInsight, hasInsight, toInsight } from "@/lib/insight";

describe("cleanInsight (저장용 정규화)", () => {
  it("핵심 인사이트(core)가 비면 null", () => {
    expect(cleanInsight({ ...EMPTY_INSIGHT })).toBeNull();
    expect(cleanInsight({ ...EMPTY_INSIGHT, core: "   " })).toBeNull();
  });

  it("앞뒤 공백 trim + 빈 질문 제거", () => {
    const r = cleanInsight({
      core: "  핵심  ",
      quote: " 인상 문장 ",
      interpretation: "",
      apply: "   ",
      similar: "사례",
      questions: ["a", "", "   ", "b"],
    });
    expect(r).toEqual({
      core: "핵심",
      quote: "인상 문장",
      interpretation: "",
      apply: "",
      similar: "사례",
      questions: ["a", "b"],
    });
  });
});

describe("toInsight (안전 변환)", () => {
  it("null/비객체는 빈 인사이트", () => {
    expect(toInsight(null)).toEqual(EMPTY_INSIGHT);
    expect(toInsight("문자열")).toEqual(EMPTY_INSIGHT);
    expect(toInsight(undefined)).toEqual(EMPTY_INSIGHT);
  });

  it("누락 필드는 빈 값, questions 는 문자열만 통과", () => {
    expect(toInsight({ core: "c", questions: ["a", 3, "b", null] })).toEqual({
      core: "c",
      quote: "",
      interpretation: "",
      apply: "",
      similar: "",
      questions: ["a", "b"],
    });
  });
});

describe("hasInsight", () => {
  it("core 가 있으면 true", () => {
    expect(hasInsight({ core: "x" })).toBe(true);
    expect(hasInsight({ core: "   " })).toBe(false);
    expect(hasInsight(null)).toBe(false);
    expect(hasInsight({ quote: "q" })).toBe(false);
  });
});
