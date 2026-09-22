import { buildReferenceMarkdown, formatExportDate, type DayExport } from "@/lib/exportRef";

const EMPTY: DayExport = {
  date: "2026-09-01",
  articles: [],
  reads: [],
  words: [],
  comments: [],
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
  it("활동이 하나도 없으면 빈 문자열 — 버튼을 안 그린다", () => {
    expect(buildReferenceMarkdown(EMPTY)).toBe("");
  });

  it("글 하나를 템플릿 순서대로 펼친다 — 제목/기업 → 한 줄 요약 → 1분 이해 → 인사이트 → 용어 → 하이라이트 → 링크", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      articles: [
        {
          title: "올영매장 고도화 여정",
          blogName: "올리브영",
          url: "https://oliveyoung.tech/x",
          oneLine: "흩어진 매장 기능을 하나의 탐색 흐름으로 묶었다",
          lead: [
            { q: "어떤 문제가 있었어요?", a: "기능이 여기저기 흩어져 있었다" },
            { q: "그래서 뭐가 달라졌어요?", a: "픽업 주문이 2배가 됐다" },
          ],
          plannerPoint: "진입 지점을 하나로 묶는 판단",
          terms: [{ term: "O2O", plain: "온라인에서 오프라인 매장으로 잇는 것" }],
          insights: [
            {
              core: "진입 지점을 하나로 묶은 게 핵심이다",
              apply: "우리 서비스도 탭을 정리해 보자",
              questions: ["우리는 어디서 이탈하고 있을까?"],
            },
          ],
          highlights: [{ quote: "정보 제공에서 행동 유도로", note: "이 문장이 결론" }],
        },
      ],
    });

    const lines = md.split("\n");
    const at = (needle: string) => lines.findIndex((l) => l.includes(needle));

    expect(lines[0]).toBe("# 2026년 9월 1일 읽은 레퍼런스");
    expect(at("## 1. 올영매장 고도화 여정 — 올리브영")).toBeGreaterThan(0);
    // 템플릿 순서가 지켜져야 한다 — 붙여넣은 문서의 읽는 순서가 곧 이 순서다.
    expect(at("**한 줄 요약**")).toBeLessThan(at("**1분 이해**"));
    expect(at("**1분 이해**")).toBeLessThan(at("**기획 포인트**"));
    expect(at("**기획 포인트**")).toBeLessThan(at("**내가 남긴 인사이트**"));
    expect(at("**내가 남긴 인사이트**")).toBeLessThan(at("**알아두면 좋은 용어**"));
    expect(at("**알아두면 좋은 용어**")).toBeLessThan(at("**하이라이트**"));
    expect(at("**하이라이트**")).toBeLessThan(at("**링크**"));

    expect(md).toContain("- **어떤 문제가 있었어요?** 기능이 여기저기 흩어져 있었다");
    expect(md).toContain("- **핵심** — 진입 지점을 하나로 묶은 게 핵심이다");
    expect(md).toContain("- **바로 적용할 것** — 우리 서비스도 탭을 정리해 보자");
    expect(md).toContain("- **질문** — 우리는 어디서 이탈하고 있을까?");
    expect(md).toContain("- **O2O** — 온라인에서 오프라인 매장으로 잇는 것");
    expect(md).toContain("> 정보 제공에서 행동 유도로");
    expect(md).toContain("> — 이 문장이 결론");
    expect(md).toContain("**링크** — [원문 보기](https://oliveyoung.tech/x)");
  });

  it("빈 칸은 통째로 뺀다 — 인사이트만 남긴 글", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      articles: [
        { title: "제목만 있는 글", insights: [{ core: "핵심 한 줄" }] },
      ],
    });
    expect(md).toContain("## 1. 제목만 있는 글");
    expect(md).toContain("- **핵심** — 핵심 한 줄");
    expect(md).not.toContain("**한 줄 요약**");
    expect(md).not.toContain("**1분 이해**");
    expect(md).not.toContain("**알아두면 좋은 용어**");
    expect(md).not.toContain("**하이라이트**");
    expect(md).not.toContain("**링크**");
  });

  it("글이 여러 개면 번호가 이어진다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      articles: [
        { title: "첫 글", insights: [{ core: "가" }] },
        { title: "둘째 글", highlights: [{ quote: "나", note: null }] },
      ],
    });
    expect(md).toContain("## 1. 첫 글");
    expect(md).toContain("## 2. 둘째 글");
  });

  it("읽기만 한 글은 맨 뒤 링크 목록으로 — 본문 블록에 섞지 않는다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      articles: [{ title: "자료가 된 글", insights: [{ core: "핵심" }] }],
      reads: [{ title: "그냥 읽은 글", blogName: "토스", url: "https://toss.tech/a" }],
    });
    const lines = md.split("\n");
    const idxArticle = lines.findIndex((l) => l.includes("## 1. 자료가 된 글"));
    const idxReads = lines.findIndex((l) => l.includes("## 읽기만 한 글"));
    expect(idxArticle).toBeLessThan(idxReads);
    expect(md).toContain("- [그냥 읽은 글](https://toss.tech/a) — 토스");
  });

  it("담은 단어와 남긴 댓글은 글 블록 뒤에 따로 모은다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      words: [{ term: "eCPM", definition: "노출 1000회당 광고 수익" }],
      comments: [{ text: "이 부분 우리도 고민했어요", sourceTitle: "누군가의 인사이트" }],
    });
    expect(md).toContain("## 담은 단어");
    expect(md).toContain("- **eCPM** — 노출 1000회당 광고 수익");
    expect(md).toContain("## 남긴 댓글");
    expect(md).toContain("- 이 부분 우리도 고민했어요 *(누군가의 인사이트)*");
  });

  it("읽기만 한 글이나 단어만 있어도 문서를 만든다", () => {
    const md = buildReferenceMarkdown({
      ...EMPTY,
      reads: [{ title: "읽은 글", blogName: null, url: null }],
    });
    expect(md).toContain("## 읽기만 한 글");
    expect(md).toContain("- 읽은 글");
  });
});
