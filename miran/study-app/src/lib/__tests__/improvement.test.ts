import {
  IMPROVEMENT_LABEL,
  classifyImprovement,
  improvementSummary,
  applyQuestion,
  fallbackQuestion,
  hypothesisQuestion,
} from "@/lib/improvement";
import { instrumentalParticle } from "@/lib/josa";

const dec = (o: Record<string, string>) => ({
  problem: "",
  constraint: "",
  chosen: "",
  rejected: "",
  metric: "",
  ...o,
});

describe("classifyImprovement — 무엇을 개선한 사례인가", () => {
  it("결정 카드의 문제/선택으로 분류한다", () => {
    expect(
      classifyImprovement({
        decision: dec({ problem: "의존성 설치 시간이 오래 걸림", chosen: "모노리포 유지" }),
      }),
    ).toBe("devex");

    expect(
      classifyImprovement({
        decision: dec({ problem: "새벽마다 장애 알림에 깸", chosen: "DLQ 프로세스 도입" }),
      }),
    ).toBe("reliability");

    expect(
      classifyImprovement({
        decision: dec({ problem: "사용자가 화면에서 헤맴", chosen: "디자인 시스템 정비" }),
      }),
    ).toBe("ux");
  });

  it("제목·태그만 있어도 분류한다(약한 신호)", () => {
    expect(classifyImprovement({ title: "리브랜딩 비하인드 3편" })).toBe("brand");
    expect(classifyImprovement({ title: "프론트와 백엔드를 한 팀으로 합치면" })).toBe("org");
  });

  it("결정 카드가 제목보다 무겁다 — 비유 제목에 속지 않는다", () => {
    // "맛있게 쪼개 먹는" 은 요리가 아니라 파티셔닝 글이다.
    const t = classifyImprovement({
      title: "수억 건의 데이터, 맛있게 쪼개 먹는 방법 (with. Partitioning)",
      decision: dec({ problem: "쿼리 응답 속도가 느림", chosen: "파티셔닝", metric: "조회 3초→0.4초" }),
    });
    expect(t).toBe("perf");
  });

  it("신호가 없으면 null — 억지로 붙이지 않는다", () => {
    expect(classifyImprovement({})).toBeNull();
    expect(classifyImprovement({ title: "그냥 인사말" })).toBeNull();
  });
});

describe("improvementSummary — ~로 ~을 개선한 사례", () => {
  it("선택한 방법 + 유형 표현으로 한 줄을 만든다", () => {
    const d = dec({ chosen: "모노리포 유지" });
    expect(improvementSummary(d, "devex")).toBe("모노리포 유지로 개발 속도를 높인 사례");
  });

  it("숫자 결과가 있으면 괄호로 덧붙인다", () => {
    const d = dec({ chosen: "파티셔닝", metric: "조회 3초→0.4초" });
    expect(improvementSummary(d, "perf")).toBe("파티셔닝으로 속도를 끌어올린 사례 (조회 3초→0.4초)");
  });

  // ⚠️ 방법(결정 카드)을 몰라도 **유형만 알면 문장을 만든다.**
  //    예전엔 여기서 null 을 돌려줘 실측 779건 중 45건에만 한 줄이 떴다.
  it("방법을 몰라도 유형만 알면 짧은 문장을 만든다", () => {
    expect(improvementSummary(dec({}), "ux")).toBe("사용자 경험을 개선한 사례");
    expect(improvementSummary(null, "perf")).toBe("속도를 끌어올린 사례");
  });

  it("유형조차 없으면 null — 없는 말을 지어내지 않는다", () => {
    expect(improvementSummary(dec({ chosen: "무언가" }), null)).toBeNull();
  });

  it("조사가 받침에 맞는다", () => {
    expect(instrumentalParticle("모노리포")).toBe("로"); // 받침 없음
    expect(instrumentalParticle("도입")).toBe("으로"); // ㅂ 받침
    expect(instrumentalParticle("파일")).toBe("로"); // ㄹ 받침
  });
});

describe("IMPROVEMENT_LABEL", () => {
  it("8종 전부 라벨이 있다", () => {
    expect(Object.keys(IMPROVEMENT_LABEL)).toHaveLength(8);
  });
});

describe("한 줄 요약 가드 — 망가진 앞머리는 떼고 뒤만 남긴다", () => {
  it("방법이 부정 서술이면 앞머리를 뗀다", () => {
    // "공통 컴포넌트로 만들지 않음으로 사용자 경험을 개선한 사례" 를 막는다(실측).
    const d = dec({ chosen: "공통 컴포넌트로 만들지 않음" });
    expect(improvementSummary(d, "ux")).toBe("사용자 경험을 개선한 사례");
  });

  it("방법이 문장처럼 길면 앞머리를 뗀다(20자 초과)", () => {
    const d = dec({ chosen: "Claude Agent SDK와 AgentCore Gateway를 활용한 전환" });
    expect(improvementSummary(d, "org")).toBe("일하는 방식을 바꾼 사례");
  });

  it("짧은 명사구면 앞머리까지 붙인다", () => {
    expect(improvementSummary(dec({ chosen: "DLQ 프로세스 도입" }), "reliability")).toBe(
      "DLQ 프로세스 도입으로 장애를 줄인 사례",
    );
  });
});

describe("fallbackQuestion — 질문은 항상 있다", () => {
  it("① 대조쌍이 없어도 선택을 알면 그 선택을 묻는다", () => {
    const q = fallbackQuestion({ decision: dec({ chosen: "모노리포 유지" }) });
    expect(q).toContain("모노리포 유지");
    expect(q.endsWith("?")).toBe(true);
  });

  it("② 결정 카드가 없어도 유형만 알면 그 유형을 묻는다", () => {
    const q = fallbackQuestion({ title: "응답 속도를 3초에서 0.4초로 줄인 방법" });
    expect(q).toBe(
      "여기서 속도를 끌어올린 방법 하나를 고른다면 무엇이고, 우리 상황에도 그대로 쓸 수 있을까요?",
    );
  });

  it("유형 문구를 홀로 두지 않는다 — '무엇을 말하는지' 먼저 적게 한다", () => {
    // 실측 사고: "장애를 줄인 방식을 우리 일에 붙인다면, 어디부터 손대시겠어요?"
    //   — 그 방식이 무엇인지 말하지 않은 채 적용을 물어서 답을 쓸 수 없었다.
    const input = { title: "결제 장애를 90% 줄인 방법" };
    for (const q of [fallbackQuestion(input), applyQuestion(input), hypothesisQuestion(input)]) {
      expect(q).toContain("방법");
      expect(q).toContain("무엇");
      expect(q.endsWith("?")).toBe(true);
    }
  });

  it("③ 아무 신호가 없어도 빈 상자를 주지 않는다", () => {
    const q = fallbackQuestion({ title: "" });
    expect(q.length).toBeGreaterThan(10);
    expect(q.endsWith("?")).toBe(true);
  });
});

describe("hypothesisQuestion (③ 가설 질문의 폴백 사다리)", () => {
  it("고른 것을 알면 '왜 그걸로 풀린다고 봤나'를 묻고, 우리 조건까지 되묻는다", () => {
    const q = hypothesisQuestion({ decision: dec({ chosen: "캐시 계층" }) });
    expect(q).toBe(
      "왜 캐시 계층으로 이 문제가 풀린다고 봤을까요? 우리 상황에도 그 근거가 성립하나요?",
    );
  });

  it("유형만 알아도 '무엇을 골랐고 왜 통할 거라 봤나'를 묻는다", () => {
    const q = hypothesisQuestion({
      decision: dec({}),
      title: "응답 속도를 3배 끌어올린 방법",
      tags: ["성능"],
    });
    expect(q).toBe("이들이 속도를 끌어올린 방법은 무엇이었고, 왜 그게 통할 거라고 봤을까요?");
  });

  it("아무 신호가 없어도 빈 상자를 주지 않는다", () => {
    expect(hypothesisQuestion({ decision: dec({}) })).toBe(
      "이들이 고른 방법은 무엇이었고, 왜 그 방법이면 문제가 풀린다고 봤을까요?",
    );
  });
});

describe("질문의 재료 — 상세의 '1분 이해'에서 뽑는다", () => {
  /** 뭘 했대요? 칸(lead.how)이 두 문장이면 **첫 문장만** 쓴다. */
  const guide = {
    summary: "배포 장애를 줄인 이야기",
    terms: [],
    lead: {
      what: "배포할 때마다 장애가 났다",
      why: "고객 이탈이 커졌다",
      how: "이상 감지를 자동화하고 롤백을 단계로 나눴다. 이후 모니터링도 붙였다",
      soWhat: "장애가 90% 줄었다",
    },
    plannerPoint: "",
    sections: [],
  };

  it("① 판단 — 방금 읽은 문장을 그대로 이어받는다", () => {
    expect(fallbackQuestion({ guide })).toBe(
      "이상 감지를 자동화하고 롤백을 단계로 나눴다 — 우리 상황에서도 같은 선택을 할 수 있을까요? 못 한다면 무엇이 달라야 할까요?",
    );
  });

  it("② 착지점 — 무엇을 가져올지 그 문장 안에서 고르게 한다", () => {
    expect(applyQuestion({ guide })).toBe(
      "이상 감지를 자동화하고 롤백을 단계로 나눴다 — 이 중 우리 제품에 가져올 하나는 무엇이고, 어느 화면·기능에 먼저 붙이시겠어요?",
    );
  });

  it("③ 가설 — 그 방법이면 풀린다고 본 근거를 묻는다", () => {
    expect(hypothesisQuestion({ guide })).toBe(
      "이상 감지를 자동화하고 롤백을 단계로 나눴다 — 왜 이 방법이면 문제가 풀린다고 봤을까요?",
    );
  });

  it("1분 이해가 아직 없으면 한 줄 요약(planner_summary)으로 내려간다", () => {
    const q = fallbackQuestion({ summary: "운영실은 Shape Up을 8주 스프린트로 바꿔 적용했다" });
    expect(q).toContain("Shape Up을 8주 스프린트로");
  });

  it("RSS 요약처럼 짧고 빈 문장은 쓰지 않는다 — 유형 템플릿으로 내려간다", () => {
    // 실측값: "당근 리더 인터뷰 - 검색실" — 질문에 넣어도 아무 말을 하지 않는다.
    const q = fallbackQuestion({ summary: "당근 리더 인터뷰", title: "장애를 줄인 방법" });
    expect(q).not.toContain("당근 리더 인터뷰");
    expect(q).toContain("방법");
  });
});
