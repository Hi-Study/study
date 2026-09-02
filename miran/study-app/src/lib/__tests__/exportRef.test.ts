import { buildReferenceMarkdown, formatExportDate, type DayExport } from "@/lib/exportRef";

const EMPTY: DayExport = {
  date: "2026-09-01",
  opinions: [],
  highlights: [],
  comments: [],
  words: [],
  reads: [],
};

describe("formatExportDate", () => {
  it("YYYY-MM-DD → 한국어 날짜", () => {
    expect(formatExportDate("2026-09-01")).toBe("2026년 9월 1일");
  });
  it("형식이 아니면 원문 그대로", () => {
    expect(formatExportDate("어제")).toBe("어제");
  });
});

describe("buildReferenceMarkdown", () => {
  it("활동이 하나도 없으면 빈 문자열 — 버튼을 비활성화한다", () => {
    expect(buildReferenceMarkdown(EMPTY)).toBe("");
  });

  it("인사이트를 항목별로 펼친다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      opinions: [
        {
          articleTitle: "결제 실패율 줄이기",
          blogName: "토스",
          articleUrl: "https://toss.tech/article/1",
          insight: {
            core: "실패를 이탈로 봤다",
            quote: "실패했을 때 뭘 보여주냐가 갈랐다",
            interpretation: "",
            apply: "우리 결제 화면에도 적용",
            similar: "",
            questions: ["재시도 횟수는 어떻게 정할까?"],
          },
        },
      ],
    });
    expect(md).toContain("# 2026년 9월 1일 읽은 레퍼런스");
    expect(md).toContain("## 남긴 인사이트");
    expect(md).toContain("[결제 실패율 줄이기](https://toss.tech/article/1) — 토스");
    expect(md).toContain("- **핵심** — 실패를 이탈로 봤다");
    expect(md).toContain("- **질문** — 재시도 횟수는 어떻게 정할까?");
    // 값이 없는 항목은 줄 자체를 만들지 않는다.
    expect(md).not.toContain("**내 해석**");
  });

  it("빈 섹션은 제목째 생략", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      words: [{ term: "멱등키", definition: "같은 요청을 여러 번 보내도 결과가 같게 하는 키" }],
    });
    expect(md).toContain("## 새로 알게 된 말");
    expect(md).not.toContain("## 남긴 인사이트");
    expect(md).not.toContain("## 읽은 글");
  });

  it("하이라이트는 인용 블록으로", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      highlights: [{ quote: "밑줄 문장", note: "내 메모", articleTitle: "글 제목" }],
    });
    expect(md).toContain("> 밑줄 문장");
    expect(md).toContain("> — 내 메모");
    expect(md).toContain("> *(글 제목)*");
  });

  it("원문 링크가 없으면 제목만(마크다운 링크 없이)", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      reads: [{ title: "제목만 있는 글", blogName: null, url: null }],
    });
    expect(md).toContain("- 제목만 있는 글");
    expect(md).not.toContain("](");
  });

  it("빈 줄이 3줄 이상 이어지지 않는다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      words: [{ term: "A" }, { term: "B" }],
      comments: [{ text: "댓글", sourceTitle: null }],
    });
    expect(md).not.toMatch(/\n{3,}/);
  });
});
