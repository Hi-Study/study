import {
  toReadingGuide,
  hasLead,
  hasPlannerPoint,
  hasSections,
  hasTerms,
  leadRows,
  splitByTerms,
} from "@/lib/guide";

const raw = {
  summary: "주문 목록이 느려진 걸 데이터를 나눠 담아 고친 이야기예요.",
  terms: [{ term: "파티셔닝", plain: "큰 데이터를 기간별로 나눠 보관하는 것" }],
  lead: {
    what: "우리 팀은 주문 목록을 여는 데 3초가 걸려 고객센터 문의가 늘고 있었어요.",
    why: "느린 화면을 그대로 두면 주문이 쌓일수록 더 느려질 수밖에 없었거든요.",
    how: "데이터를 기간별로 나눠 담고, 최근 것만 먼저 읽도록 바꿨어요.",
    soWhat: "이제 목록이 0.4초에 뜨고, 같은 방식을 다른 화면에도 쓰기로 했어요.",
  },
  plannerPoint: "비슷한 걸 검토할 때 '지금 양으로 되나'가 아니라 '10배가 되면 되나'를 먼저 물어야 한다는 사례예요.",
  sections: [
    {
      question: "왜 그렇게 느려졌을까요?",
      problem: "한 테이블에 5년 치 주문이 전부 쌓여 있었어요.",
      paras: ["오래된 주문을 따로 떼어 냈어요.", "최근 것만 먼저 읽도록 바꿨어요."],
      outcome: "원인을 찾고 나서 데이터를 나눠 담기로 정했어요.",
      blocks: [4, 5],
      terms: [],
    },
    {
      question: "어떻게 고쳤을까요?",
      problem: "데이터가 한 곳에 몰려 있어 읽을 때마다 전체를 훑었어요.",
      paras: ["파티셔닝으로 데이터를 기간별로 나눠 담았어요."],
      outcome: "목록 여는 시간이 3초에서 0.4초가 됐어요.",
      blocks: [12],
      terms: ["파티셔닝"],
    },
  ],
};

describe("toReadingGuide", () => {
  it("정상 값을 통과시킨다", () => {
    const g = toReadingGuide(raw)!;
    expect(g.lead.what.length).toBeGreaterThan(0);
    expect(g.sections).toHaveLength(2);
    expect(g.terms).toHaveLength(1);
    expect(g.summary.length).toBeGreaterThan(0);
  });

  it("객체가 아니면 null", () => {
    expect(toReadingGuide(null)).toBeNull();
    expect(toReadingGuide("x")).toBeNull();
    expect(toReadingGuide(undefined)).toBeNull();
  });

  it("옛 형식(steps)은 못 읽으므로 null — 화면이 다시 만든다", () => {
    expect(toReadingGuide({ intro: "x", steps: [{ start: 0, title: "t" }] })).toBeNull();
  });

  it("v2 형식(points·details)도 null — 시간순 나열은 버린 구조다", () => {
    expect(
      toReadingGuide({
        summary: "요약",
        terms: [],
        points: [{ text: "가나다라마바사", block: 1, terms: [] }],
        details: [],
      }),
    ).toBeNull();
  });

  it("문단도 문제도 없는 칸은 버린다 — 질문만 남으면 빈 카드가 된다", () => {
    const g = toReadingGuide({
      ...raw,
      sections: [...raw.sections, { question: "빈 칸?", paras: ["  "], blocks: [1], terms: [] }],
    })!;
    expect(g.sections).toHaveLength(2);
  });

  it("문제만 있고 해결이 없어도 칸은 살린다 — 문제를 아는 것만으로도 값이 있다", () => {
    const g = toReadingGuide({
      ...raw,
      sections: [{ question: "왜요?", problem: "목록이 3초나 걸렸어요.", paras: [], blocks: [1], terms: [] }],
    })!;
    expect(g.sections).toHaveLength(1);
    expect(g.sections[0].problem).toContain("3초");
  });

  it("음수·중복 블록은 버린다 — 같은 문단이 두 번 펼쳐지면 근거가 많아 보이는 착시가 생긴다", () => {
    const g = toReadingGuide({
      ...raw,
      sections: [{ question: "왜?", paras: ["가나다"], blocks: [-5, 3, 3, 7], terms: [] }],
    })!;
    expect(g.sections[0].blocks).toEqual([3, 7]);
  });

  it("옛 저장본의 단일 block 도 받아 배열로 만든다", () => {
    const g = toReadingGuide({
      ...raw,
      sections: [{ question: "왜?", paras: ["가나다"], block: 9, terms: [] }],
    })!;
    expect(g.sections[0].blocks).toEqual([9]);
  });

  it("블록이 하나도 없으면 빈 배열 — 화면은 원문 버튼을 아예 숨긴다", () => {
    const g = toReadingGuide({
      ...raw,
      sections: [{ question: "왜?", paras: ["가나다"], terms: [] }],
    })!;
    expect(g.sections[0].blocks).toEqual([]);
  });

  it("용어는 term·plain 이 둘 다 있어야 하고 최대 8개 — 비개발자가 막히는 말은 4개로 안 끝난다", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ term: `t${i}`, plain: `p${i}` }));
    const g = toReadingGuide({ ...raw, terms: [...many, { term: "x", plain: "" }] })!;
    expect(g.terms).toHaveLength(8);
  });

  it("리드가 비면 null — 용어만 남은 가이드는 글을 설명하지 못한다", () => {
    expect(
      toReadingGuide({ summary: "요약", terms: raw.terms, lead: {}, sections: [] }),
    ).toBeNull();
  });
});

describe("표시 여부 판단", () => {
  it("'무슨 일'만 있고 나머지가 비면 리드로 안 친다 — 제목의 반복일 뿐", () => {
    const g = toReadingGuide({ ...raw, lead: { what: raw.lead.what, why: "", how: "", soWhat: "" } });
    expect(g).toBeNull();
    expect(hasLead(g)).toBe(false);
  });

  it("'왜'가 비어도 나머지가 있으면 리드로 친다 — 칸마다 따로 판단한다", () => {
    const g = toReadingGuide({ ...raw, lead: { ...raw.lead, why: "" } })!;
    expect(hasLead(g)).toBe(true);
    expect(leadRows(g).map((r) => r.q)).toEqual([
      "어떤 문제가 있었어요?",
      "뭘 했대요?",
      "그래서 뭐가 달라졌어요?",
    ]);
  });

  it("소제목 칸이 없으면 그 칸만 숨긴다", () => {
    const g = toReadingGuide({ ...raw, sections: [] });
    expect(hasSections(g)).toBe(false);
    expect(hasLead(g)).toBe(true);
    expect(hasTerms(g)).toBe(true); // 칸마다 따로 판단한다
  });

  it("기획 포인트가 짧으면 안 띄운다 — '참고할 만해요' 같은 말은 아무것도 말하지 않는다", () => {
    expect(hasPlannerPoint(toReadingGuide({ ...raw, plannerPoint: "참고할 만해요" }))).toBe(false);
    expect(hasPlannerPoint(toReadingGuide({ ...raw, plannerPoint: "" }))).toBe(false);
    expect(hasPlannerPoint(toReadingGuide(raw))).toBe(true);
  });

  it("칸마다 자기 결말을 갖는다 — 없으면 빈 문자열이라 화면이 그 줄만 숨긴다", () => {
    const g = toReadingGuide(raw)!;
    expect(g.sections[1].outcome).toContain("0.4초");
    const none = toReadingGuide({
      ...raw,
      sections: [{ question: "왜?", paras: ["가나다"], blocks: [1], terms: [] }],
    })!;
    expect(none.sections[0].outcome).toBe("");
  });

  it("leadRows 는 채워진 칸만 질문과 함께 돌려준다", () => {
    const g = toReadingGuide(raw)!;
    expect(leadRows(g)).toHaveLength(4);
    expect(leadRows(g)[0].q).toBe("어떤 문제가 있었어요?");
  });
});

describe("splitByTerms — 용어 밑줄 자리 찾기", () => {
  it("용어를 조각으로 분리한다", () => {
    const parts = splitByTerms("우리는 파티셔닝을 썼다", ["파티셔닝"]);
    expect(parts.map((p) => p.text)).toEqual(["우리는 ", "파티셔닝", "을 썼다"]);
    expect(parts[1].term).toBe("파티셔닝");
  });

  it("긴 용어를 먼저 잡는다 — 짧은 쪽이 먼저 걸리면 엉뚱하게 끊긴다", () => {
    const parts = splitByTerms("AB 테스트를 돌렸다", ["AB", "AB 테스트"]);
    expect(parts[0].term).toBe("AB 테스트");
  });

  it("같은 용어가 여러 번 나오면 모두 잡는다", () => {
    const parts = splitByTerms("캐시와 캐시", ["캐시"]);
    expect(parts.filter((p) => p.term === "캐시")).toHaveLength(2);
  });

  it("용어가 없으면 통째로 한 조각", () => {
    expect(splitByTerms("그냥 문장", [])).toEqual([{ text: "그냥 문장", term: null }]);
  });

  it("한 글자 용어는 무시한다 — 조사·어미에 걸려 문장이 잘게 부서진다", () => {
    expect(splitByTerms("가나다", ["가"])).toEqual([{ text: "가나다", term: null }]);
  });

  it("조각을 이어 붙이면 원문 그대로다", () => {
    const text = "캐시를 늘리는 대신 파티셔닝을 골랐다";
    const joined = splitByTerms(text, ["캐시", "파티셔닝"]).map((p) => p.text).join("");
    expect(joined).toBe(text);
  });
});
