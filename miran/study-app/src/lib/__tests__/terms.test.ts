import { termCount, termDomain, termList, toTerms } from "@/lib/terms";

const TERMS = [
  { term: "카나리 배포", plain: "일부에게 먼저 배포", why: "위험을 줄인다", domain: "infra" },
  { term: "리텐션", plain: "다시 돌아오는 비율", why: "성장 지표", domain: "marketing" },
  { term: "빈값", plain: "", why: "", domain: "dev" },
];

describe("toTerms (안전 변환)", () => {
  it("배열이 아니면 빈 배열", () => {
    expect(toTerms(null)).toEqual([]);
    expect(toTerms({ term: "x" })).toEqual([]);
  });

  it("term 이 없는 항목은 버린다", () => {
    expect(toTerms([{ plain: "설명만" }, { term: "  " }, { term: "정상" }])).toEqual([
      { term: "정상", plain: "", why: "", domain: "" },
    ]);
  });
});

describe("termDomain (누른 단어 → 영역)", () => {
  it("정확히 같으면 매칭", () => {
    expect(termDomain(TERMS, "리텐션")).toBe("marketing");
  });

  it("본문은 '카나리 배포'인데 '카나리'만 눌러도 매칭된다", () => {
    expect(termDomain(TERMS, "카나리")).toBe("infra");
  });

  it("대소문자·공백·구분자는 무시", () => {
    const rows = [{ term: "A/B 테스트", plain: "p", why: "w", domain: "product" }];
    expect(termDomain(rows, "A/B테스트")).toBe("product");
  });

  it("못 찾으면 null — 단어는 저장되고 영역만 빈다", () => {
    expect(termDomain(TERMS, "생소한말")).toBeNull();
    expect(termDomain(null, "리텐션")).toBeNull();
    expect(termDomain(TERMS, "")).toBeNull();
  });

  it("domain 이 빈 항목은 매칭 대상이 아니다", () => {
    expect(termDomain([{ term: "x", plain: "p", why: "w", domain: "" }], "x")).toBeNull();
  });
});

describe("termCount / termList", () => {
  it("termCount 는 형식이 맞는 항목 수", () => {
    expect(termCount(TERMS)).toBe(3);
    expect(termCount(null)).toBe(0);
  });

  it("termList 는 풀이(plain)가 있는 것만", () => {
    expect(termList(TERMS).map((t) => t.term)).toEqual(["카나리 배포", "리텐션"]);
  });

  it("termList 는 limit 을 지킨다", () => {
    expect(termList(TERMS, 1)).toHaveLength(1);
  });
});
