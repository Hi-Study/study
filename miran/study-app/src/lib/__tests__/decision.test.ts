import {
  objectParticle,
  subjectParticle,
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
      "토스는 왜 무제한 재시도 대신 재시도 3회 + 멱등키를 골랐을까요?",
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
      "왜 무제한 재시도 대신 재시도 3회 + 멱등키를 골랐을까요?",
    );
  });
});

describe("isUsableQuestion (저장된 질문 검증 게이트)", () => {
  it("두 선택지가 문장에 다 살아 있어야 통과", () => {
    const q = "토스는 왜 무제한 재시도 대신 재시도 3회 + 멱등키를 골랐을까요?";
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
  // ⚠️ "선택한 방법"은 일부러 빠져 있다 — 제목 아래 한 줄이 이미 그 말을 해서
  //    카드가 같은 내용을 두 번 말하고 있었다.
  it("값이 있는 항목만 순서대로 — 선택한 방법은 넣지 않는다", () => {
    expect(decisionRows({ problem: "문제", chosen: "선택" })).toEqual([
      { label: "무슨 문제", value: "문제" },
    ]);
  });

  it("전부 있으면 4줄(문제·제약·버린 대안·결과)", () => {
    expect(decisionRows(FULL)).toHaveLength(4);
    expect(decisionRows(FULL).map((r) => r.label)).not.toContain("선택한 방법");
  });
});

describe("comparablePair — 어색한 질문을 아예 만들지 않는다", () => {
  it("실측 실패 사례: 같은 대상을 긍정/부정으로 적은 쌍은 탈락", () => {
    // "공통 컴포넌트화 대신 공통 컴포넌트로 만들지 않음을 골랐을까요?" 를 막는다.
    const bad = { ...FULL, rejected: "공통 컴포넌트화", chosen: "공통 컴포넌트로 만들지 않음" };
    expect(questionFromDecision(bad, "카카오페이")).toBeNull();
    expect(isUsableQuestion("아무 질문", bad)).toBe(false);
  });

  it("부정 서술이 섞이면 탈락", () => {
    expect(questionFromDecision({ ...FULL, chosen: "캐시 미사용", rejected: "캐시" }, null)).toBeNull();
  });

  it("문장처럼 길면 탈락(20자 초과)", () => {
    const longOne = { ...FULL, chosen: "재시도 횟수를 3회로 제한하고 멱등키를 함께 도입", rejected: "무제한 재시도" };
    expect(questionFromDecision(longOne, null)).toBeNull();
  });

  it("한쪽이 다른 쪽을 포함하면 탈락", () => {
    expect(questionFromDecision({ ...FULL, chosen: "단일 테이블 구조", rejected: "단일 테이블" }, null)).toBeNull();
  });

  it("비교 가능한 짧은 명사구 한 쌍은 통과", () => {
    const ok = { ...FULL, chosen: "단일 테이블", rejected: "테이블 분리" };
    expect(questionFromDecision(ok, "토스")).toBe("토스는 왜 테이블 분리 대신 단일 테이블을 골랐을까요?");
  });
});

describe("objectParticle · 서술형 꼬리", () => {
  it("받침 있으면 을, 없으면 를", () => {
    expect(objectParticle("대조")).toBe("를");   // 조 = 받침 없음
    expect(objectParticle("단일 테이블")).toBe("을"); // 블 = 받침 있음
  });

  it("영문·숫자로 끝나면 를", () => {
    expect(objectParticle("MRAID")).toBe("를");
  });

  it("조사가 문장에 실제로 반영된다", () => {
    const d = { ...FULL, chosen: "과거 장애 패턴 대조", rejected: "보안 취약점 스캔" };
    expect(questionFromDecision(d, "카카오")).toBe(
      "카카오는 왜 보안 취약점 스캔 대신 과거 장애 패턴 대조를 골랐을까요?",
    );
  });

  it("서술형 꼬리(…선택)는 질문을 만들지 않는다", () => {
    // "MRAID 표준을 선택을 골랐을까요?" 같은 중복을 막는다(실측).
    const d = { ...FULL, chosen: "MRAID 표준을 선택", rejected: "다른 규약" };
    expect(questionFromDecision(d, "토스")).toBeNull();
  });
});

describe("subjectParticle — 기업명 뒤 은/는", () => {
  it("받침 있으면 은", () => {
    expect(subjectParticle("올리브영")).toBe("은");
    expect(subjectParticle("당근")).toBe("은");
  });

  it("받침 없으면 는", () => {
    expect(subjectParticle("토스")).toBe("는");
    expect(subjectParticle("카카오")).toBe("는");
  });

  it("질문 문장에 반영된다 — 올리브영는(X) 올리브영은(O)", () => {
    const d = { ...FULL, chosen: "웹 컴포넌트", rejected: "시스템 마이그레이션" };
    expect(questionFromDecision(d, "올리브영")).toBe(
      "올리브영은 왜 시스템 마이그레이션 대신 웹 컴포넌트를 골랐을까요?",
    );
  });
});
