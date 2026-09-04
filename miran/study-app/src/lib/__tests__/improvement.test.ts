import {
  IMPROVEMENT_LABEL,
  classifyImprovement,
  improvementSummary,
  fallbackQuestion,
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
    expect(q).toContain("속도를 끌어올린");
  });

  it("③ 아무 신호가 없어도 빈 상자를 주지 않는다", () => {
    const q = fallbackQuestion({ title: "" });
    expect(q.length).toBeGreaterThan(10);
    expect(q.endsWith("?")).toBe(true);
  });
});
