import {
  objectParticle,
  subjectParticle,

  hasDecision,
  isUsableQuestion,
  metricBelongsToChoice,
  questionFromDecision,
  toDecision,
  hypothesisQuestionFromDecision,
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

  // ⚠️ 예전엔 "버린 대안이 없으면 null" 이었다. 그래서 결정 카드 70건 중 15건에만
  //    질문이 붙었다 — problem·constraint·metric 이라는 재료를 두고도 버린 셈이다.
  //    이제 재료가 있는 만큼 아래 단계로 내려가며 만든다.
  it("버린 대안이 없으면 제약으로 내려가 질문을 만든다", () => {
    const q = questionFromDecision({ ...FULL, rejected: "" }, "토스");
    expect(q).toContain("PG 응답이 3초까지 지연");
    expect(q).toContain("재시도 3회 + 멱등키");
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
  // ⚠️ 예전엔 "대조쌍으로 조립된 질문"만 통과시켜서, LLM 이 잘 쓴 질문까지 전부 버려졌다
  //    (779건 중 15건만 남았다). 이제 enrich 가 고유명사 포함 여부까지 검사한 것만
  //    저장하므로, 앱은 **일반론만** 걸러낸다.
  it("구체적인 질문은 통과", () => {
    expect(isUsableQuestion("토스는 왜 무제한 재시도 대신 멱등키를 골랐을까요?")).toBe(true);
    expect(isUsableQuestion("Lynx를 웹뷰 대신 고른 기준이 우리 앱에도 맞을까요?")).toBe(true);
  });

  it("어느 글에나 붙는 일반적인 질문은 탈락", () => {
    expect(isUsableQuestion("이 글의 핵심은 무엇인가요?")).toBe(false);
    expect(isUsableQuestion("어떤 점이 가장 인상 깊으셨나요?")).toBe(false);
    expect(isUsableQuestion("저자가 말하려는 바는 무엇인가요?")).toBe(false);
  });

  it("너무 짧거나·비었거나·물음표가 없으면 탈락", () => {
    expect(isUsableQuestion("")).toBe(false);
    expect(isUsableQuestion(null)).toBe(false);
    expect(isUsableQuestion("왜요?")).toBe(false);
    expect(isUsableQuestion("멱등키를 쓰면 재시도가 안전해집니다")).toBe(false);
  });
});

describe("comparablePair — 어색한 질문을 아예 만들지 않는다", () => {
  it("실측 실패 사례: 같은 대상을 긍정/부정으로 적은 쌍은 탈락", () => {
    // "공통 컴포넌트화 대신 공통 컴포넌트로 만들지 않음을 골랐을까요?" 를 막는다.
    const bad = { ...FULL, rejected: "공통 컴포넌트화", chosen: "공통 컴포넌트로 만들지 않음" };
    expect(questionFromDecision(bad, "카카오페이")).toBeNull();
  });

  it("부정 서술이 섞이면 탈락", () => {
    expect(questionFromDecision({ ...FULL, chosen: "캐시 미사용", rejected: "캐시" }, null)).toBeNull();
  });

  it("문장처럼 길면 탈락(20자 초과)", () => {
    const longOne = { ...FULL, chosen: "재시도 횟수를 3회로 제한하고 멱등키를 함께 도입", rejected: "무제한 재시도" };
    expect(questionFromDecision(longOne, null)).toBeNull();
  });

  it("한쪽이 다른 쪽을 포함하면 탈락", () => {
    // 대조로는 못 쓰지만(같은 대상) 제약 단계로 내려가 질문은 만들어진다.
    const q = questionFromDecision({ ...FULL, chosen: "단일 테이블 구조", rejected: "단일 테이블" }, null);
    expect(q).not.toContain("대신");
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
    // 조사를 이미 달고 있어서 어느 단계에서도 끼울 수 없다 → 질문을 만들지 않는다.
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

describe("metricBelongsToChoice — 이 숫자가 고른 것의 성과인가", () => {
  it("비교 대상의 숫자는 거른다 — 실측 사고(PolicyGuard)", () => {
    expect(
      metricBelongsToChoice("PolicyGuard 프레임워크", "Presidio Effective Block Rate 62.2%"),
    ).toBe(false);
  });

  it("고른 것의 이름으로 시작하면 통과", () => {
    expect(metricBelongsToChoice("PolicyGuard 프레임워크", "PolicyGuard EBR 94.1%")).toBe(true);
  });

  it("지표 이름(일반명사)으로 시작하면 통과 — 과잉 차단하지 않는다", () => {
    expect(metricBelongsToChoice("재시도 3회 + 멱등키", "실패율 2.1%→0.4%")).toBe(true);
    expect(metricBelongsToChoice("멀티 센터", "배송 시간 14시간 단축")).toBe(true);
  });

  // 전부 대문자 약어를 제품명으로 오인해 멀짱한 지표 4건을 버렸던 적이 있다(실측).
  it("전부 대문자인 약어는 제품명이 아니다", () => {
    expect(metricBelongsToChoice("Valkey 9.1 업그레이드", "CPU 86.6% 감소")).toBe(true);
    expect(metricBelongsToChoice("커뮤니티 영역 분리", "RPS 100→4,000→20,000")).toBe(true);
    expect(metricBelongsToChoice("대시보드 구축", "LLM 비용 64% 절감")).toBe(true);
    expect(metricBelongsToChoice("match boolean gate", "JSON 파싱 실패율 0건")).toBe(true);
  });

  it("빈 metric 은 통과시키지 않는다", () => {
    expect(metricBelongsToChoice("무엇이든", "")).toBe(false);
  });

  it("남의 숫자면 '골랐더니 ~' 질문을 만들지 않는다", () => {
    const d = {
      problem: "",
      constraint: "",
      chosen: "PolicyGuard 프레임워크",
      rejected: "",
      metric: "Presidio Effective Block Rate 62.2%",
    };
    // 조립할 재료가 없으므로 null — 호출부가 유형 템플릿으로 내려간다.
    expect(questionFromDecision(d, null)).toBeNull();
  });

  it("제 성과면 ④ 가지가 그대로 동작한다", () => {
    const d = {
      problem: "",
      constraint: "",
      chosen: "멀티 센터",
      rejected: "",
      metric: "배송 시간 14시간 단축",
    };
    expect(questionFromDecision(d, null)).toBe(
      "멀티 센터를 골랐더니 배송 시간 14시간 단축 — 무엇이 이 차이를 만들었을까요?",
    );
  });
});

describe("hypothesisQuestionFromDecision (③ 가설 질문)", () => {
  const dec = (o: Record<string, string>) => ({
    problem: "",
    constraint: "",
    chosen: "",
    rejected: "",
    metric: "",
    ...o,
  });

  it("문제+해법이 있으면 **둘 사이의 연결**을 묻는다 — 원인은 글에 있으니 되묻지 않는다", () => {
    const q = hypothesisQuestionFromDecision(
      dec({ problem: "결제 실패가 반복됐다", chosen: "지연 재시도" }),
      "토스",
    );
    expect(q).toBe("결제 실패가 반복됐다 — 토스는 왜 지연 재시도로 이게 풀린다고 봤을까요?");
    // ⚠️ 원인을 되묻는 문장이면 답이 본문 베끼기가 된다.
    expect(q).not.toContain("무엇이 원인");
  });

  it("버린 대안이 있으면 '왜 저건 안 되고 이건 된다고 봤나'로 같은 걸 묻는다", () => {
    const q = hypothesisQuestionFromDecision(
      dec({ chosen: "지연 재시도", rejected: "즉시 재시도" }),
      null,
    );
    expect(q).toBe("왜 즉시 재시도로는 안 되고 지연 재시도로 풀린다고 봤을까요?");
  });

  it("제약만 있으면 그 조건에서도 통할 거라고 본 근거를 묻는다", () => {
    const q = hypothesisQuestionFromDecision(
      dec({ constraint: "서버를 늘릴 수 없었다", chosen: "캐시 계층" }),
      null,
    );
    expect(q).toContain("고르면 풀린다고 본 근거");
  });

  it("자기 숫자가 있으면 '해보기 전에' 무엇을 믿었는지 묻는다", () => {
    const q = hypothesisQuestionFromDecision(
      dec({ chosen: "멀티 센터", metric: "배송 시간 14시간 단축" }),
      null,
    );
    expect(q).toContain("해보기 전에 이만큼 달라질 거라고 본 근거");
  });

  it("남의 숫자로는 만들지 않는다 — 사실이 뒤집힌 질문이 나온다", () => {
    expect(
      hypothesisQuestionFromDecision(
        dec({ chosen: "PolicyGuard 프레임워크", metric: "Presidio Effective Block Rate 62.2%" }),
        null,
      ),
    ).toBeNull();
  });

  it("재료가 없으면 null — 호출부가 유형 템플릿으로 내려간다", () => {
    expect(hypothesisQuestionFromDecision(dec({}), null)).toBeNull();
  });
});
