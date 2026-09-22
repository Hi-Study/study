import { summaryLine } from "@/lib/summaryLine";

describe("summaryLine — 히어로 한 줄 요약 다듬기", () => {
  it("끝난 문장만 모으고 잘린 꼬리는 버린다", () => {
    const raw =
      "저희 팀은 데이터 입수 플랫폼의 배치 워크플로를 Airflow 2.10.2로 운영하고 있습니다. " +
      "2025년 4월 Airflow 3.0이 릴리즈되었고, UI 개선과 다양한 신규 기능..";
    const out = summaryLine(raw);
    expect(out).toBe("저희 팀은 데이터 입수 플랫폼의 배치 워크플로를 Airflow 2.10.2로 운영하고 있습니다.");
    expect(out.endsWith("..")).toBe(false);
  });

  it("온전한 문장이 여러 개면 길이 한도까지 이어 붙인다", () => {
    const raw = "첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.";
    expect(summaryLine(raw, 200)).toBe("첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.");
  });

  it("한도를 넘는 문장은 넣지 않는다 — 자르지 않고 통째로 뺀다", () => {
    const raw = "짧은 문장입니다. " + "아주 긴 문장입니다 ".repeat(20) + "끝났습니다.";
    const out = summaryLine(raw, 40);
    expect(out).toBe("짧은 문장입니다.");
  });

  it("온전한 문장이 하나도 없으면 조각을 쓰되 말줄임표로 맺는다", () => {
    expect(summaryLine("문장이 끝나지 않고 계속 이어지는 조각인데요 그래도 길게..")).toBe(
      "문장이 끝나지 않고 계속 이어지는 조각인데요 그래도 길게…",
    );
  });

  it("'더보기' 같은 잔재를 걷어낸다", () => {
    expect(summaryLine("어딘가에서 잘려 온 설명 더보기")).toBe("어딘가에서 잘려 온 설명…");
  });

  it("HTML 태그와 엔티티를 지운다", () => {
    expect(summaryLine("<p>태그가 섞인 <b>요약</b>입니다.</p>")).toBe("태그가 섞인 요약입니다.");
    expect(summaryLine("A&amp;B 이야기입니다.")).toBe("A&B 이야기입니다.");
  });

  it("줄바꿈·연속 공백을 한 칸으로 접는다", () => {
    expect(summaryLine("여러\n\n줄로   된   요약입니다.")).toBe("여러 줄로 된 요약입니다.");
  });

  it("빈 값은 빈 문자열", () => {
    expect(summaryLine(null)).toBe("");
    expect(summaryLine(undefined)).toBe("");
    expect(summaryLine("   ")).toBe("");
  });

  it("물음표·느낌표로 끝나는 문장도 끝난 것으로 본다", () => {
    expect(summaryLine("왜 느려졌을까요? 원인을 찾아봤습니다.", 200)).toBe(
      "왜 느려졌을까요? 원인을 찾아봤습니다.",
    );
  });

  it("결과에 말줄임표가 두 번 붙지 않는다", () => {
    expect(summaryLine("끝나지 않은 조각입니다만…")).not.toMatch(/…\s*…/);
  });
});
