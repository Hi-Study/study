import {
  collectMyActivity,
  filterActivity,
  activityCounts,
  activityCategories,
  activityBlogs,
  activityServices,
  activitySummary,
  facetCount,
  resolveFilter,
  EMPTY_FACETS,
  type MyActivityItem,
} from "@/lib/myActivity";

const article = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  blog: { name: "토스" },
  ...extra,
});

const byId = (items: MyActivityItem[], id: string) => items.find((i) => i.articleId === id)!;

describe("collectMyActivity", () => {
  it("한 글에 남긴 것을 카드 하나로 합친다 — 탭을 옮겨 다니지 않게", () => {
    const items = collectMyActivity({
      reads: [{ ...article("a1", "결제 실패를 줄인 방법"), read_at: "2026-09-10T00:00:00Z" }],
      opinions: [
        {
          id: "o1",
          insight: { core: "재시도 정책이 핵심", coreQ: "이 글에서 무엇을 보셨나요?" },
          created_at: "2026-09-11T00:00:00Z",
          article: article("a1", "결제 실패를 줄인 방법"),
        },
      ],
      highlights: [
        {
          id: "h1",
          quote: "재시도는 실패를 늦출 뿐",
          note: "",
          color: "yellow",
          created_at: "2026-09-12T00:00:00Z",
          article: article("a1", "결제 실패를 줄인 방법"),
        },
      ],
    });
    expect(items).toHaveLength(1);
    const it = items[0];
    expect(it.title).toBe("결제 실패를 줄인 방법");
    expect(it.blogName).toBe("토스");
    expect(it.read).toBe(true);
    // 인사이트는 전문을 들고 온다 — 화면이 질문·답 쌍으로 그린다.
    expect(it.opinions[0].insight.core).toBe("재시도 정책이 핵심");
    expect(it.opinions[0].insight.coreQ).toBe("이 글에서 무엇을 보셨나요?");
    expect(it.highlights[0].quote).toBe("재시도는 실패를 늦출 뿐");
    // 가장 마지막에 손댄 시각이 남는다 — 목록 순서의 기준이다.
    expect(it.latest).toBe("2026-09-12T00:00:00Z");
  });

  it("최근에 손댄 글이 위 — 날짜 없는 글은 맨 아래", () => {
    const items = collectMyActivity({
      reads: [
        { ...article("a1", "오래된 글"), read_at: "2026-09-01T00:00:00Z" },
        { ...article("a2", "최근 글"), read_at: "2026-09-20T00:00:00Z" },
      ],
      words: [{ id: "w1", term: "LTV", definition: "고객 생애 가치", article_id: "a3", article: article("a3", "단어만 담은 글") }],
    });
    expect(items.map((i) => i.articleId)).toEqual(["a2", "a1", "a3"]);
  });

  it("읽지 않은 글에 남긴 활동도 목록에 들어온다 — 읽음이 아니라 활동이 기준", () => {
    const items = collectMyActivity({
      highlights: [
        {
          id: "h1",
          quote: "문장",
          created_at: "2026-09-12T00:00:00Z",
          article: article("a9", "안 끝까지 읽은 글"),
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].read).toBe(false);
  });

  it("댓글은 인사이트가 달린 글로 붙는다", () => {
    const items = collectMyActivity({
      comments: [
        {
          id: "m1",
          text: "이 부분 공감돼요",
          created_at: "2026-09-13T00:00:00Z",
          opinion: { id: "o1", article: article("a1", "결제 실패를 줄인 방법") },
        },
      ],
    });
    expect(byId(items, "a1").comments[0].text).toBe("이 부분 공감돼요");
  });

  it("용어는 단어장과 같은 규칙으로 붙고, 담은 단어는 원본 행 그대로 남는다", () => {
    const words = [
      { id: "w1", term: "eCPM", definition: "내가 받은 뜻", domain: null, article_id: "a1", hit_count: 3 },
    ];
    const items = collectMyActivity({
      reads: [
        {
          ...article("a1", "광고 수익 이야기", {
            terms: [{ term: "eCPM", plain: "노출 1000회당 광고 수익", domain: "marketing", why: "" }],
            reading_guide: { terms: [{ term: "임프레션", plain: "광고가 보인 횟수" }] },
          }),
          read_at: "2026-09-10T00:00:00Z",
        },
      ],
      words,
    });
    const it = items[0];
    expect(it.terms.map((t) => t.term)).toEqual(["eCPM", "임프레션"]);
    // 화면이 WordCard(삭제·뜻 재생성)를 그리려면 원본 행이 그대로 와야 한다.
    expect(it.terms[0].picked).toBe(words[0]);
  });

  it("주제는 어느 목록에서 왔든 채워진다 — 먼저 온 값이 비어 있으면 뒤에서 받는다", () => {
    const items = collectMyActivity({
      reads: [{ ...article("a1", "글"), read_at: "2026-09-10T00:00:00Z" }],
      opinions: [
        {
          id: "o1",
          insight: { core: "메모" },
          created_at: "2026-09-11T00:00:00Z",
          article: article("a1", "글", { planner_category: "AI 활용" }),
        },
      ],
    });
    expect(items[0].category).toBe("AI 활용");
  });
});

describe("필터", () => {
  const items = collectMyActivity({
    reads: [
      { ...article("a1", "읽기만 한 글", { planner_category: "AI 활용" }), read_at: "2026-09-10T00:00:00Z" },
      {
        ...article("a2", "밑줄 그은 글", {
          planner_category: "데이터·실험",
          terms: [{ term: "코호트", plain: "같은 시기에 묶은 사용자", domain: "data", why: "" }],
        }),
        read_at: "2026-09-11T00:00:00Z",
      },
    ],
    highlights: [
      {
        id: "h1",
        quote: "문장",
        created_at: "2026-09-12T00:00:00Z",
        article: article("a2", "밑줄 그은 글", { planner_category: "데이터·실험" }),
      },
    ],
  });

  it("칩의 숫자는 **글 수** — 목록의 줄 수와 같아야 한다", () => {
    expect(activityCounts(items)).toEqual({
      opinions: 0,
      highlights: 1,
      comments: 0,
      words: 1,
    });
  });

  it("종류 필터는 그 종류를 남긴 글만 남긴다 — 읽기만 한 글은 목록에 없다", () => {
    expect(filterActivity(items, "highlights").map((i) => i.articleId)).toEqual(["a2"]);
    expect(filterActivity(items, "words").map((i) => i.articleId)).toEqual(["a2"]);
    // a1 은 읽기만 했다 — 어느 칩에도 걸리지 않는다.
    expect(filterActivity(items, "opinions")).toEqual([]);
  });

  it("주제 필터는 종류 필터와 함께 걸린다", () => {
    const pick = (category: string) =>
      filterActivity(items, "highlights", { ...EMPTY_FACETS, category }).map((i) => i.articleId);
    expect(pick("데이터·실험")).toEqual(["a2"]);
    // 0건이어도 막지 않는다 — 없으면 없다고 목록이 말한다.
    expect(pick("AI 활용")).toEqual([]);
  });

  it("고른 칩이 0건이면 있는 칩으로 옮긴다 — 빈 화면을 첫 인상으로 주지 않는다", () => {
    const counts = activityCounts(items);
    expect(resolveFilter("opinions", counts)).toBe("highlights");
    expect(resolveFilter("words", counts)).toBe("words");
    // 모두 비면 고른 값을 그대로 둔다(그 필터의 빈 상태 문구가 나간다).
    expect(resolveFilter("comments", { opinions: 0, highlights: 0, comments: 0, words: 0 })).toBe(
      "comments",
    );
  });

  it("주제 칩은 가진 주제만, 기준 v1 순서로 낸다", () => {
    expect(activityCategories(items)).toEqual(["AI 활용", "데이터·실험"]);
  });

  it("요약 줄은 인사이트 → 밑줄 → 댓글 → 용어 순, 남긴 게 없으면 '읽음'", () => {
    expect(activitySummary(byId(items, "a2"))).toBe("밑줄 1 · 용어 1");
    expect(activitySummary(byId(items, "a1"))).toBe("읽음");
  });
});

describe("좁히기 — 주제·기업·서비스 종류·기간", () => {
  const now = Date.parse("2026-09-22T00:00:00Z");
  const article = (id: string, title: string, blog: string, key: string, extra = {}) => ({
    id,
    title,
    blog: { name: blog, key },
    ...extra,
  });
  const items = collectMyActivity({
    reads: [
      {
        ...article("a1", "토스 글", "토스", "toss", { planner_category: "AI 활용" }),
        read_at: "2026-09-20T00:00:00Z",
      },
      {
        ...article("a2", "당근 글", "당근", "daangn", { planner_category: "데이터·실험" }),
        read_at: "2026-06-01T00:00:00Z",
      },
    ],
    highlights: [
      { id: "h1", quote: "문장", created_at: "2026-09-20T00:00:00Z", article: article("a1", "토스 글", "토스", "toss") },
      { id: "h2", quote: "문장", created_at: "2026-06-01T00:00:00Z", article: article("a2", "당근 글", "당근", "daangn") },
    ],
  });

  it("기업으로 좁힌다", () => {
    expect(
      filterActivity(items, "highlights", { ...EMPTY_FACETS, blog: "토스" }, now).map((i) => i.articleId),
    ).toEqual(["a1"]);
  });

  it("서비스 종류로 좁힌다 — 기업 키에서 낸다(lib/serviceKind)", () => {
    const services = activityServices(items);
    expect(services.length).toBeGreaterThan(0);
    const rows = filterActivity(items, "highlights", { ...EMPTY_FACETS, service: services[0] }, now);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("기간으로 좁힌다 — 마지막으로 손댄 때가 기준", () => {
    expect(
      filterActivity(items, "highlights", { ...EMPTY_FACETS, period: "week" }, now).map((i) => i.articleId),
    ).toEqual(["a1"]);
    expect(filterActivity(items, "highlights", { ...EMPTY_FACETS, period: "year" }, now)).toHaveLength(2);
  });

  it("축은 함께 걸린다 — 하나라도 어긋나면 빠진다", () => {
    expect(
      filterActivity(items, "highlights", { ...EMPTY_FACETS, blog: "토스", period: "week" }, now),
    ).toHaveLength(1);
    expect(
      filterActivity(items, "highlights", { ...EMPTY_FACETS, blog: "당근", period: "week" }, now),
    ).toEqual([]);
  });

  it("기업 후보는 많이 남긴 순, 같으면 가나다순", () => {
    // 둘 다 한 건씩이라 이름순으로 떨어진다 — 같은 데이터에서 순서가 뒤집히지 않게.
    expect(activityBlogs(items)).toEqual(["당근", "토스"]);
  });

  it("고른 축의 개수를 센다 — 버튼에 '필터 2'로 적는다", () => {
    expect(facetCount(EMPTY_FACETS)).toBe(0);
    expect(facetCount({ ...EMPTY_FACETS, blog: "토스", period: "week" })).toBe(2);
  });
});
