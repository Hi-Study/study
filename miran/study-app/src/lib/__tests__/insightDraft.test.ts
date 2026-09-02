import { draftFromHighlights, draftPromptSource } from "@/lib/insightDraft";

describe("draftFromHighlights (하이라이트 → 인사이트 초안)", () => {
  it("하이라이트가 없으면 usedCount 0 — 이 경로를 띄우지 않는다", () => {
    const r = draftFromHighlights([]);
    expect(r.usedCount).toBe(0);
    expect(r.insight.quote).toBe("");
    expect(r.needsAi).toBe(false);
  });

  it("가장 길게 그은 문장을 대표 인용으로 쓴다", () => {
    const r = draftFromHighlights([
      { quote: "짧은 문장", note: null },
      { quote: "이게 훨씬 더 길게 그은 문장이라 대표가 된다", note: null },
    ]);
    expect(r.insight.quote).toBe("이게 훨씬 더 길게 그은 문장이라 대표가 된다");
    expect(r.usedCount).toBe(2);
  });

  it("메모가 있으면 해석에 잇고 첫 메모를 핵심 씨앗으로", () => {
    const r = draftFromHighlights([
      { quote: "문장A", note: "결제 실패를 이탈로 봤다" },
      { quote: "문장B", note: "지표를 먼저 정의했다" },
    ]);
    expect(r.insight.core).toBe("결제 실패를 이탈로 봤다");
    expect(r.insight.interpretation).toBe("결제 실패를 이탈로 봤다\n지표를 먼저 정의했다");
    expect(r.needsAi).toBe(false);
  });

  it("메모가 하나도 없으면 needsAi — 사람이 쓴 재료가 없다는 뜻", () => {
    const r = draftFromHighlights([{ quote: "문장만 그었다", note: null }]);
    expect(r.needsAi).toBe(true);
    expect(r.insight.core).toBe("");
    expect(r.insight.quote).toBe("문장만 그었다");
  });

  it("빈 하이라이트(인용도 메모도 없음)는 재료에서 뺀다", () => {
    const r = draftFromHighlights([
      { quote: "  ", note: "  " },
      { quote: "쓸모 있는 문장", note: null },
    ]);
    expect(r.usedCount).toBe(1);
  });

  it("메모만 있고 인용이 없어도 동작", () => {
    const r = draftFromHighlights([{ quote: null, note: "메모만 남겼다" }]);
    expect(r.insight.quote).toBe("");
    expect(r.insight.core).toBe("메모만 남겼다");
    expect(r.usedCount).toBe(1);
  });
});

describe("draftPromptSource (AI 에 넘길 재료 — 본문은 넣지 않는다)", () => {
  it("인용 + 메모를 한 줄씩", () => {
    const src = draftPromptSource([
      { quote: "문장A", note: "내 생각" },
      { quote: "문장B", note: null },
    ]);
    expect(src).toBe('- "문장A" (내 메모: 내 생각)\n- "문장B"');
  });

  it("재료가 없으면 빈 문자열 — 호출하지 않는다", () => {
    expect(draftPromptSource([])).toBe("");
    expect(draftPromptSource([{ quote: null, note: null }])).toBe("");
  });
});
