import {
  IMPROVEMENT_LABEL,
  classifyImprovement,
  improvementSummary,
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
  it("선택한 방법 + 태그 라벨로 한 줄을 만든다", () => {
    const d = dec({ chosen: "모노리포 유지" });
    expect(improvementSummary(d, "devex")).toBe("모노리포 유지로 개발 생산성을 개선한 사례");
  });

  it("숫자 결과가 있으면 괄호로 덧붙인다", () => {
    const d = dec({ chosen: "파티셔닝", metric: "조회 3초→0.4초" });
    expect(improvementSummary(d, "perf")).toBe("파티셔닝으로 성능을 개선한 사례 (조회 3초→0.4초)");
  });

  it("선택한 방법이 없으면 null", () => {
    expect(improvementSummary(dec({}), "ux")).toBeNull();
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

describe("한 줄 요약 가드 — 망가진 문장은 아예 안 만든다", () => {
  it("방법이 부정 서술이면 접는다", () => {
    // "공통 컴포넌트로 만들지 않음으로 UI/UX를 개선한 사례" 를 막는다(실측).
    const d = dec({ chosen: "공통 컴포넌트로 만들지 않음" });
    expect(improvementSummary(d, "ux")).toBeNull();
  });

  it("방법이 문장처럼 길면 접는다(20자 초과)", () => {
    const d = dec({ chosen: "Claude Agent SDK와 AgentCore Gateway를 활용한 전환" });
    expect(improvementSummary(d, "org")).toBeNull();
  });

  it("짧은 명사구면 정상 생성", () => {
    expect(improvementSummary(dec({ chosen: "DLQ 프로세스 도입" }), "reliability")).toBe(
      "DLQ 프로세스 도입으로 장애 대응을 개선한 사례",
    );
  });
});
