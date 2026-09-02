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

describe("og:image 절대경로 해석", () => {
  const body = `<article>${"<p>본문으로 인정될 만큼 충분히 긴 실제 문장을 넉넉하게 적었습니다. </p>".repeat(6)}</article>`;

  const withOg = (content: string) =>
    `<html><head><meta property="og:image" content="${content}"></head><body>${body}</body></html>`;

  it("절대 URL 은 그대로", () => {
    expect(extractArticle(withOg("https://x/i.png"), "https://blog.example.com/post/1").image).toBe(
      "https://x/i.png",
    );
  });

  it("상대경로는 글 URL 기준으로 절대화 — 이걸 안 하면 썸네일이 통째로 빈다", () => {
    expect(extractArticle(withOg("/static/cover.png"), "https://blog.example.com/post/1").image).toBe(
      "https://blog.example.com/static/cover.png",
    );
  });

  it("프로토콜 상대(//) 는 https 로", () => {
    expect(extractArticle(withOg("//cdn.example.com/a.png")).image).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("base 를 모르면 상대경로는 버린다(렌더 불가)", () => {
    expect(extractArticle(withOg("/static/cover.png")).image).toBeNull();
  });

  it("data: 인라인 이미지는 대표 이미지로 쓰지 않는다", () => {
    expect(extractArticle(withOg("data:image/png;base64,AAAA"), "https://b.com/p").image).toBeNull();
  });
});
