import {
  classifyReadingBlock,
  domainOf,
  groupSentencesIntoBlocks,
  looksLikeStaleArticle,
  splitSentences,
  stripArticleNoise,
  tokenizeWords,
} from "@/lib/text";

describe("stripArticleNoise (꼬리에서만 안전 제거)", () => {
  const body =
    "요즘 뭔가를 배우는 방식이 예전과는 꽤 달라졌다는 걸 느낍니다. 새로운 기술과 도구가 쉴 새 없이 쏟아지다 보니 빠르게 익히고 넘어갑니다.\n" +
    "오늘 비운 한 칸이 어떤 그림이 될지는, 한참 지나 돌아볼 때라야 보일 겁니다. 그래도 괜찮으니 천천히 가보기로 합니다.";

  it("본문 뒤 사이트 꼬리(고객문의·사업자정보 등)를 제거한다", () => {
    const footer =
      "고객 문의\n02-6925-4867\n이용약관\n개인정보 처리방침\n사업자등록번호 : 209-81-57303";
    expect(stripArticleNoise(`${body}\n${footer}`)).toBe(body);
  });

  it("꼬리가 없으면 그대로 둔다", () => {
    expect(stripArticleNoise(body)).toBe(body);
  });

  it("본문 중간에 우연히 든 단어로는 절대 자르지 않는다(과거 버그 회귀 방지)", () => {
    const tricky =
      "이용약관을 둘러싼 오해를 다룬 글입니다. 사람들이 자주 묻는 질문을 하나씩 짚어보며 배경까지 함께 설명합니다.\n" +
      "결론적으로 약관은 우리 일상에 깊이 관여하므로, 잘 읽는 습관이 필요하다는 점을 오래 기억하면 좋겠습니다.";
    // 마지막 줄이 '진짜 문장'이라 아무것도 잘리지 않아야 한다
    expect(stripArticleNoise(tricky)).toBe(tricky);
  });

  it("전부 짧은 줄이면 원문을 보존한다(본문 통째 삭제 금지)", () => {
    const shortish = "짧은 메모.\n한 줄 더.";
    expect(stripArticleNoise(shortish)).toBe(shortish);
  });

  it("빈 값은 빈 문자열", () => {
    expect(stripArticleNoise("")).toBe("");
  });
});

describe("looksLikeStaleArticle", () => {
  it("옛 방식 잡음(사업자등록번호 등)이 있으면 true", () => {
    expect(looksLikeStaleArticle("본문...\n사업자등록번호 : 209-81-57303")).toBe(true);
    expect(looksLikeStaleArticle("본문...\n고객 문의\n이용약관")).toBe(true);
  });
  it("깨끗한 본문/빈값은 false", () => {
    expect(looksLikeStaleArticle("깨끗하게 추출된 본문입니다.")).toBe(false);
    expect(looksLikeStaleArticle(null)).toBe(false);
    expect(looksLikeStaleArticle(undefined)).toBe(false);
  });
});

describe("splitSentences (하이라이트 앵커)", () => {
  it("★ 조각을 이어붙이면 원문과 정확히 같다(문장 순번이 모든 클라에서 일치)", () => {
    const texts = [
      "안녕하세요. 반가워요! 잘 지내죠?\n두 번째 문단입니다. 끝.",
      "마침표 없는 마지막 줄",
      "여러\n\n빈 줄\n\n포함",
      "숫자 3.5 같은 소수도 깨지지 않고 이어붙으면 원문과 같다.",
    ];
    for (const t of texts) {
      expect(splitSentences(t).join("")).toBe(t);
    }
  });

  it("문장 끝(. ! ?)과 줄바꿈에서 나눈다", () => {
    expect(splitSentences("가. 나! 다?")).toEqual(["가.", " 나!", " 다?"]);
    expect(splitSentences("한 줄\n두 줄")).toEqual(["한 줄\n", "두 줄"]);
  });

  it("빈 값은 빈 배열", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("tokenizeWords (단어장 저장 후보)", () => {
  it("공백으로 나누고 앞뒤 문장부호를 벗긴다(조사는 보존)", () => {
    expect(tokenizeWords("클라우드 네이티브 아키텍처를 도입했다.")).toEqual([
      "클라우드",
      "네이티브",
      "아키텍처를",
      "도입했다",
    ]);
  });

  it("2글자 미만(조사·한 글자)은 버린다", () => {
    expect(tokenizeWords("이 A OS 를 봐")).toEqual(["OS"]);
  });

  it("중복 단어는 한 번만 남긴다", () => {
    expect(tokenizeWords("API API 설계 설계")).toEqual(["API", "설계"]);
  });

  it("빈 값은 빈 배열", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("groupSentencesIntoBlocks (리치 리딩 · 하이라이트 순번 보존)", () => {
  const text = "들어가며\n첫 문장. 둘째 문장.\n- 목록 하나\n마무리";
  const sentences = splitSentences(text);
  const blocks = groupSentencesIntoBlocks(sentences);

  it("줄 단위로 4블록(소제목·문단·목록·소제목)으로 묶는다", () => {
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "para", "list", "heading"]);
  });

  it("★ 각 문장의 전역 index 를 splitSentences 순번 그대로 보존한다(순수 개행 조각만 버림)", () => {
    const flatIdx = blocks.flatMap((b) => b.items.map((it) => it.index));
    // 원래 문장 중 '공백/개행만'인 조각의 index 는 빠지고, 나머지는 순서·값 그대로
    const visibleIdx = sentences.map((_, i) => i).filter((i) => sentences[i].trim() !== "");
    expect(flatIdx).toEqual(visibleIdx);
  });

  it("빈 본문은 빈 블록 배열", () => {
    expect(groupSentencesIntoBlocks(splitSentences(""))).toEqual([]);
  });
});

describe("classifyReadingBlock", () => {
  it("목록 마커(- • 1.)로 시작하면 list", () => {
    expect(classifyReadingBlock("- 항목")).toBe("list");
    expect(classifyReadingBlock("1. 배경")).toBe("list");
    expect(classifyReadingBlock("• 포인트")).toBe("list");
  });
  it("짧고 종결부호로 끝나지 않으면 heading", () => {
    expect(classifyReadingBlock("들어가며")).toBe("heading");
    expect(classifyReadingBlock("배경:")).toBe("heading");
  });
  it("종결부호로 끝나거나 길면 para", () => {
    expect(classifyReadingBlock("이것은 하나의 문장입니다.")).toBe("para");
    expect(
      classifyReadingBlock("이 문단은 소제목이라기엔 충분히 길어서 문단으로 분류되어야 합니다"),
    ).toBe("para");
  });
});

describe("domainOf", () => {
  it("호스트만 뽑고 www 를 제거한다", () => {
    expect(domainOf("https://www.yozm.wishket.com/magazine/detail/123/")).toBe(
      "yozm.wishket.com",
    );
    expect(domainOf("https://n.news.naver.com/article/001/0001")).toBe(
      "n.news.naver.com",
    );
  });
  it("잘못된 URL 은 최대한 도메인처럼 반환", () => {
    expect(domainOf("naver.me/abcd")).toBe("naver.me");
  });
});
