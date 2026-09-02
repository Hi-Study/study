import {
  decisionRows,
  hasDecision,
  isUsableQuestion,
  questionFromDecision,
  toDecision,
} from "@/lib/decision";

const FULL = {
  problem: "결제 실패가 이탈로 이어졌다",
  constraint: "PG 응답이 3초까지 지연",
  chosen: "재시도 3회 + 멱등키",
  rejected: "무제한 재시도",
  metric: "실패율 2.1%→0.4%",
};

describe("toDecision (안전 변환)", () => {
  it("객체가 아니면 전부 빈 값", () => {
    expect(toDecision(null).problem).toBe("");
    expect(toDecision("문자열").chosen).toBe("");
    expect(toDecision(undefined).metric).toBe("");
  });

  it("누락 필드는 빈 문자열, 앞뒤 공백은 제거", () => {
    const d = toDecision({ problem: "  문제  ", chosen: "선택" });
    expect(d.problem).toBe("문제");
    expect(d.chosen).toBe("선택");
    expect(d.rejected).toBe("");
  });
});

describe("hasDecision (카드를 띄울지)", () => {
  it("문제 + 선택이 둘 다 있어야 통과", () => {
    expect(hasDecision(FULL)).toBe(true);
    expect(hasDecision({ ...FULL, problem: "" })).toBe(false);
    expect(hasDecision({ ...FULL, chosen: "" })).toBe(false);
  });

  it("회고·문화 글처럼 decision 이 없으면 false", () => {
    expect(hasDecision(null)).toBe(false);
    expect(hasDecision({})).toBe(false);
  });
});

describe("questionFromDecision (자유 생성 금지 — 조립만)", () => {
  it("선택과 버린 대안이 둘 다 있을 때만 만든다", () => {
    expect(questionFromDecision(FULL, "토스")).toBe(
      "토스는 왜 무제한 재시도 대신 재시도 3회 + 멱등키을 골랐을까요?",
    );
  });

  it("버린 대안이 없으면 null — 억지로 만들지 않는다", () => {
    expect(questionFromDecision({ ...FULL, rejected: "" }, "토스")).toBeNull();
  });

  it("선택이 없어도 null", () => {
    expect(questionFromDecision({ ...FULL, chosen: "" }, "토스")).toBeNull();
  });

  it("출처가 없으면 주어 없이 '왜'로 시작", () => {
    expect(questionFromDecision(FULL, null)).toBe(
      "왜 무제한 재시도 대신 재시도 3회 + 멱등키을 골랐을까요?",
    );
  });
});

describe("isUsableQuestion (저장된 질문 검증 게이트)", () => {
  it("두 선택지가 문장에 다 살아 있어야 통과", () => {
    const q = "토스는 왜 무제한 재시도 대신 재시도 3회 + 멱등키을 골랐을까요?";
    expect(isUsableQuestion(q, FULL)).toBe(true);
  });

  it("어느 글에나 붙는 일반적인 질문은 탈락", () => {
    expect(isUsableQuestion("이 글의 핵심은 무엇인가요?", FULL)).toBe(false);
    expect(isUsableQuestion("여러분의 서비스에도 적용할 수 있을까요?", FULL)).toBe(false);
  });

  it("너무 짧거나 비면 탈락", () => {
    expect(isUsableQuestion("", FULL)).toBe(false);
    expect(isUsableQuestion(null, FULL)).toBe(false);
    expect(isUsableQuestion("왜요?", FULL)).toBe(false);
  });

  it("결정 카드가 반쪽이면 어떤 질문도 통과 못 함", () => {
    expect(isUsableQuestion("무제한 재시도 대신 재시도 3회", { ...FULL, rejected: "" })).toBe(false);
  });
});

describe("decisionRows (화면 표시용)", () => {
  it("값이 있는 항목만 순서대로", () => {
    expect(decisionRows({ problem: "문제", chosen: "선택" })).toEqual([
      { label: "무슨 문제", value: "문제" },
      { label: "선택한 방법", value: "선택" },
    ]);
  });

  it("전부 있으면 5줄", () => {
    expect(decisionRows(FULL)).toHaveLength(5);
  });
});
