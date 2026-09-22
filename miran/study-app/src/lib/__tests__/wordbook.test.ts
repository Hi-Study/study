import {
  collectWordbook,
  wordbookCount,
  PICKED_GROUP_TITLE,
  type WordbookRead,
} from "@/lib/wordbook";

const article = (id: string, title: string, terms: unknown, guide?: unknown): WordbookRead => ({
  id,
  title,
  terms,
  reading_guide: guide,
});

const t = (term: string, plain: string, domain: string) => ({ term, plain, domain, why: "" });

describe("collectWordbook", () => {
  it("읽은 글별로 그 글의 용어를 묶는다 — 읽은 순서 그대로", () => {
    const groups = collectWordbook([
      article("a1", "카프카 이야기", [
        t("파티셔닝", "데이터를 나눠 저장하는 것", "dev"),
        t("멱등성", "여러 번 해도 결과가 같은 것", "dev"),
      ]),
      article("a2", "실험 플랫폼", [t("코호트", "같은 시기에 묶은 사용자 집단", "data")]),
    ]);
    expect(groups.map((g) => g.articleId)).toEqual(["a1", "a2"]);
    expect(groups[0].title).toBe("카프카 이야기");
    expect(groups[0].items.map((i) => i.term)).toEqual(["파티셔닝", "멱등성"]);
    expect(groups[1].items.map((i) => i.term)).toEqual(["코호트"]);
    expect(wordbookCount(groups)).toBe(3);
  });

  it("용어가 없는 글은 빼고 — 제목만 있는 빈 카드는 만들지 않는다", () => {
    const groups = collectWordbook([
      article("a1", "용어 없는 글", []),
      article("a2", "용어 있는 글", [t("RAG", "문서를 찾아 붙여 답하게 하는 방식", "data")]),
    ]);
    expect(groups.map((g) => g.articleId)).toEqual(["a2"]);
  });

  it("같은 단어가 여러 글에 나오면 글마다 따로 남는다 — 맥락이 다르다", () => {
    const groups = collectWordbook([
      article("a1", "글 1", [t("RAG", "문서를 찾아 붙여 답하게 하는 방식", "data")]),
      article("a2", "글 2", [t("RAG", "검색으로 근거를 붙이는 방식", "data")]),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items[0].plain).toBe("문서를 찾아 붙여 답하게 하는 방식");
    expect(groups[1].items[0].plain).toBe("검색으로 근거를 붙이는 방식");
  });

  it("가이드 용어도 같은 글에 함께 담고, 한 글 안 중복은 영역 있는 쪽을 남긴다", () => {
    const groups = collectWordbook([
      article("a1", "글 1", [t("SLO", "서비스 수준 목표", "infra")], {
        terms: [
          { term: "SLO", plain: "지켜야 할 목표치" },
          { term: "에러 버짓", plain: "허용되는 실패의 양" },
        ],
      }),
    ]);
    expect(groups[0].items.map((i) => i.term)).toEqual(["SLO", "에러 버짓"]);
    expect(groups[0].items[0].plain).toBe("서비스 수준 목표");
    expect(groups[0].items[0].domain).toBe("infra");
    expect(groups[0].items[1].domain).toBe("");
  });

  it("내가 담은 단어는 그 글의 같은 줄에 붙어 삭제·뜻 재생성을 유지한다", () => {
    const groups = collectWordbook(
      [article("a1", "글 1", [t("eCPM", "노출 1000회당 광고 수익", "marketing")])],
      [{ id: "w1", term: "ecpm", definition: "내가 받은 뜻", domain: null, article_id: "a1" }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].picked?.id).toBe("w1");
    expect(groups[0].items[0].plain).toBe("노출 1000회당 광고 수익");
  });

  it("그 글에 없던 단어를 담았으면 그 글 묶음에 줄을 더한다", () => {
    const groups = collectWordbook(
      [article("a1", "글 1", [t("eCPM", "노출 1000회당 광고 수익", "marketing")])],
      [{ id: "w1", term: "LTV", definition: "고객 생애 가치", domain: "biz", article_id: "a1" }],
    );
    expect(groups[0].items.map((i) => i.term)).toEqual(["eCPM", "LTV"]);
    expect(groups[0].items[1].picked?.id).toBe("w1");
  });

  it("읽은 글에 속하지 않은 담은 단어는 맨 아래 한 묶음으로 남는다", () => {
    const groups = collectWordbook(
      [article("a1", "글 1", [t("가", "뜻", "dev")])],
      [{ id: "w1", term: "LTV", definition: "고객 생애 가치", domain: "biz", article_id: null }],
    );
    expect(groups.map((g) => g.title)).toEqual(["글 1", PICKED_GROUP_TITLE]);
    expect(groups[1].articleId).toBe("");
    expect(groups[1].items[0]).toEqual({
      term: "LTV",
      plain: "고객 생애 가치",
      domain: "biz",
      picked: { id: "w1", term: "LTV", definition: "고객 생애 가치", domain: "biz", article_id: null },
    });
  });

  it("뜻이 없는 용어는 버린다 — 단어만 있으면 단어장이 아니다", () => {
    const groups = collectWordbook([article("a1", "글", [t("가", "", "dev")])]);
    expect(groups).toEqual([]);
    expect(wordbookCount(groups)).toBe(0);
  });
});
