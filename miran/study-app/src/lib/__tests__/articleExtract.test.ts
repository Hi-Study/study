import { extractArticle } from "@/lib/articleExtract";

describe("extractArticle (온디바이스 추출 — 서버와 동일 휴리스틱)", () => {
  it("문단밀도: 실제 문장이 담긴 <p>만 모으고 메뉴/짧은 링크는 배제", () => {
    // 각 문단은 40자↑, 전체 합 300자↑ 이어야 문단밀도 경로가 동작한다.
    const long =
      "이것은 본문으로 인정될 만큼 충분히 긴 실제 문장이며 문단밀도 임계를 넘기려고 넉넉하게 적었습니다. ".repeat(2);
    const html = `
      <html><head>
        <meta property="og:image" content="https://x/i.png">
        <meta property="og:description" content="요약설명">
      </head><body>
        <nav><p><a href="/">홈</a></p></nav>
        <article>
          <p>첫 번째 문단입니다. ${long}</p>
          <p>두 번째 문단입니다. ${long}</p>
          <p>세 번째 문단입니다. ${long}</p>
          <p>네 번째 문단입니다. ${long}</p>
          <p><a href="/a">관련</a> <a href="/b">링크</a> <a href="/c">여러</a> 개</p>
        </article>
      </body></html>`;
    const r = extractArticle(html);
    expect(r.image).toBe("https://x/i.png");
    expect(r.excerpt).toBe("요약설명");
    expect(r.text).toContain("첫 번째 문단");
    expect(r.text).toContain("두 번째 문단");
    // 링크만 여러 개인 <p>(메뉴/관련)은 제외
    expect(r.text).not.toContain("관련");
  });

  it("본문이 없으면(짧으면) null", () => {
    expect(extractArticle("<html><body><p>짧다</p></body></html>").text).toBeNull();
  });
});
