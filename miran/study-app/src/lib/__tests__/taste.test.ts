import {
  analyzeTaste,
  tasteLine,
  tasteNarrative,
  TASTE_MIN,
  type TasteInput,
} from "@/lib/taste";

const read = (category: string | null, tags?: Record<string, unknown>): TasteInput =>
  ({ planner_category: category, planner_tags: tags } as TasteInput);

describe("analyzeTaste", () => {
  it("분류 없는 글은 분모에서 뺀다 — 안 그러면 비율이 전부 낮게 나온다", () => {
    const t = analyzeTaste([read("AI 활용"), read(null), read(null)]);
    expect(t.total).toBe(1);
    expect(t.categories[0]).toEqual({ label: "AI 활용", count: 1, share: 1 });
  });

  it("많이 읽은 대분류 순으로 돌려준다", () => {
    const t = analyzeTaste([
      read("AI 활용"),
      read("AI 활용"),
      read("사용자 이해·경험"),
      read("협업·프로세스"),
      read("AI 활용"),
    ]);
    expect(t.categories.map((x) => x.label)).toEqual([
      "AI 활용",
      "사용자 이해·경험",
      "협업·프로세스",
    ]);
    expect(t.categories[0].count).toBe(3);
    expect(t.categories[0].share).toBeCloseTo(0.6);
  });

  it("태그는 2번 이상 걸린 것만 — 한 번은 우연이다", () => {
    const t = analyzeTaste([
      read("데이터·실험", { purpose: "성장", methods: ["A/B 테스트"] }),
      read("데이터·실험", { purpose: "성장", methods: ["지표 설계"] }),
    ]);
    expect(t.tags.map((x) => x.label)).toEqual(["성장"]);
  });

  it("'사내 업무'는 취향을 구분하지 못해 뺀다", () => {
    const t = analyzeTaste([
      read("AI 활용", { contexts: ["사내 업무"] }),
      read("AI 활용", { contexts: ["사내 업무"] }),
    ]);
    expect(t.tags).toEqual([]);
  });

  it(`${TASTE_MIN}편 미만이면 취향을 말하지 않는다`, () => {
    expect(analyzeTaste([read("AI 활용")]).enough).toBe(false);
    expect(analyzeTaste(Array(TASTE_MIN).fill(read("AI 활용"))).enough).toBe(true);
  });
});

describe("tasteLine", () => {
  it("한 편도 없으면 권유만 한다", () => {
    expect(tasteLine(analyzeTaste([]))).toBe("글을 읽으면 취향을 알려드려요");
  });

  it("표본이 적으면 몇 편 더 읽으면 되는지 말한다", () => {
    expect(tasteLine(analyzeTaste([read("AI 활용"), read("AI 활용")]))).toBe(
      `읽은 글 2편 · ${TASTE_MIN - 2}편 더 읽으면 취향이 보여요`,
    );
  });

  it("1등이 절반을 넘으면 한 갈래로 말한다", () => {
    const t = analyzeTaste([
      read("AI 활용"),
      read("AI 활용"),
      read("AI 활용"),
      read("협업·프로세스"),
      read("사업·브랜드"),
    ]);
    expect(tasteLine(t)).toBe("AI 활용 글을 주로 읽어요");
  });

  it("고르게 퍼져 있으면 두 갈래를 나란히 말한다", () => {
    const t = analyzeTaste([
      read("AI 활용"),
      read("AI 활용"),
      read("사용자 이해·경험"),
      read("사용자 이해·경험"),
      read("사업·브랜드"),
    ]);
    expect(tasteLine(t)).toBe("AI 활용 · 사용자 이해·경험 글을 많이 읽어요");
  });
});

describe("tasteNarrative", () => {
  const tasteOf = (n: number, tags?: Record<string, unknown>) =>
    analyzeTaste(Array.from({ length: n }, () => read("AI 활용", tags)));

  it("한 편도 없으면 권유 문장", () => {
    expect(tasteNarrative({ name: "미란", taste: analyzeTaste([]) })).toBe(
      "미란님, 첫 글을 읽으면 관심 주제를 찾아드려요.",
    );
  });

  it("표본이 적으면 몇 편 더 읽으면 되는지 말한다", () => {
    expect(tasteNarrative({ name: "미란", taste: tasteOf(2) })).toBe(
      `미란님은 지금 취향을 만드는 중이에요. ${TASTE_MIN - 2}편 더 읽으면 관심 주제를 알려드릴게요.`,
    );
  });

  it("관심 주제 + 이번 달 활동 + 자주 고른 태그를 한 문단으로", () => {
    const taste = tasteOf(6, { purpose: "효율화", methods: ["업무 자동화"] });
    expect(tasteNarrative({ name: "미란", taste, monthReads: 12, monthOpinions: 3 })).toBe(
      "미란님은 AI 활용 글에 관심이 많아요. 이번 달엔 12편을 읽고 인사이트 3개를 남겼어요." +
        " 그중에서도 효율화·업무 자동화 이야기를 자주 골랐어요.",
    );
  });

  it("0 은 문장에 넣지 않는다 — 벌칙이 된다", () => {
    const taste = tasteOf(6);
    const s = tasteNarrative({ name: "미란", taste, monthReads: 0, monthOpinions: 0 });
    expect(s).toBe("미란님은 AI 활용 글에 관심이 많아요.");
    const s2 = tasteNarrative({ name: "미란", taste, monthReads: 4, monthOpinions: 0 });
    expect(s2).toBe("미란님은 AI 활용 글에 관심이 많아요. 이번 달엔 4편을 읽었어요.");
  });

  it("1등이 절반을 못 넘으면 두 주제를 비슷하게 본다고 말한다", () => {
    const taste = analyzeTaste([
      read("AI 활용"),
      read("AI 활용"),
      read("사용자 이해·경험"),
      read("사용자 이해·경험"),
      read("사업·브랜드"),
    ]);
    expect(tasteNarrative({ name: "미란", taste })).toBe(
      "미란님은 AI 활용과 사용자 이해·경험 글을 비슷하게 봐요.",
    );
  });
});

describe("기업 축 — 취향의 나머지 반", () => {
  const read = (cat: string | null, blog: string | null) => ({
    planner_category: cat as never,
    blog: blog ? { name: blog } : null,
  });

  it("많이 읽은 기업 순으로 세고, 분모는 **읽은 글 전체**다", () => {
    const t = analyzeTaste([
      read("AI 활용", "토스"),
      read("AI 활용", "토스"),
      // 분류가 없는 글도 출처는 분명하다 — 기업 분모에는 들어간다.
      read(null, "당근"),
      read(null, null),
    ]);
    expect(t.blogs.map((b) => [b.label, b.count])).toEqual([
      ["토스", 2],
      ["당근", 1],
    ]);
    expect(t.totalReads).toBe(4);
    expect(t.blogs[0].share).toBeCloseTo(0.5);
    // 대분류 분모는 분류된 글만 — 두 축의 분모가 다르다.
    expect(t.total).toBe(2);
    expect(t.categories[0].share).toBe(1);
  });

  it("기업 이름이 없으면 세지 않는다", () => {
    const t = analyzeTaste([read(null, "   "), read(null, null)]);
    expect(t.blogs).toEqual([]);
  });
});
