/**
 * 시리즈 — **여러 편으로 나뉜 글을 한 묶음으로 본다**(스키마 §40).
 *
 * ⚠️ **여기가 정본이다.** 수집(collect)이 글을 저장할 때 이 함수를 불러
 *    `series_key / series_no` 를 함께 적는다. 그래서 새 글은 **자동으로** 시리즈가 된다.
 *    `scripts/series.mjs` 는 이 파일에서 규칙을 읽어 옛 글을 다시 채운다 —
 *    규칙을 두 벌로 두면 수집한 글과 다시 채운 글이 서로 다른 시리즈가 된다.
 *
 * 왜 필요한가: 시리즈 중간편은 그 편만 열면 무슨 이야기인지 알 수 없다.
 * "왜 만들었나"는 1편에만 있고 중간편은 구현만 다루는 일이 흔하다.
 * 그렇다고 중간편을 빼면 이야기가 끊긴다 — 그래서 **빼지 않고 상세에서 같이 보여준다.**
 *
 * ⚠️ 제목으로만 가른다(블로그가 시리즈를 표시해 주지 않는다).
 *    대신 묶을 때 **같은 블로그 안에서만** 묶는다 — 제목이 겹치는 남의 글과 섞이지 않게.
 * ⚠️ **1편만 있어도 적어 둔다.** 2편이 나중에 들어오면 그때 저절로 시리즈가 된다.
 *    "2편 이상일 때만 시리즈"는 **보여줄 때** 판단한다(카드가 2편 미만이면 안 그린다).
 */

/** 회차 표시 패턴 — 위에서부터 보고 처음 맞는 것을 쓴다. */
const NUMBER_PATTERNS: RegExp[] = [
  /Part\s*[.\-]?\s*(\d+)/i,
  /(\d+)\s*편(?![가-힣])/,
  /[(（](\d+)[)）]\s*[:：\-]/,
  /#\s*(\d+)/,
  /(\d+)\s*부(?![가-힣])/,
  /제\s*(\d+)\s*화/,
];

/** 블로그 이름이 제목 뒤에 붙는 곳들 — 시리즈 키를 만들 때 걷어낸다. */
const BLOG_SUFFIX = /\s*[|\-–—]\s*(tech\.kakao\.com|카카오페이 기술 블로그|오늘의집 블로그)\s*$/i;

export interface SeriesInfo {
  /** 시리즈 이름(같은 블로그 안에서 이 값이 같으면 한 묶음). */
  key: string;
  /** 회차. 上/下 는 1/2 로 본다. */
  no: number;
}

/**
 * 제목에서 시리즈 정보를 뽑는다. 시리즈가 아니면 null.
 *
 * ⚠️ 회차 **앞부분**만 키로 쓴다. 뒤는 각 편의 부제라서 편마다 달라진다 —
 *    "…패러다임 - Part 2. 모듈 페더레이션" 과 "…패러다임 - Part 3. Nx 활용" 은
 *    뒤까지 넣으면 다른 시리즈가 되어 버린다(실측: 이걸로 9개밖에 못 찾았다가 23개가 됐다).
 */
export function seriesOf(title: string): SeriesInfo | null {
  const t = title.replace(BLOG_SUFFIX, "").trim();

  // 괄호 안에 "… 시리즈 N" 이 있으면 그 시리즈명이 키다(제목 앞부분이 편마다 다른 경우).
  const paren = t.match(/[(（]([^)）]*?시리즈)\s*(\d+)[)）]/);
  if (paren) return { key: paren[1].trim(), no: Number(paren[2]) };

  for (const re of NUMBER_PATTERNS) {
    const m = t.match(re);
    // index > 4: 제목 맨 앞의 숫자(연도 등)를 회차로 잘못 읽지 않게.
    if (m && m.index !== undefined && m.index > 4) {
      const key = t.slice(0, m.index).replace(/[\s:：\-–—,.]+$/, "").trim();
      if (key.length >= 6) return { key, no: Number(m[1]) };
    }
  }

  const ud = t.match(/[(（]\s*(上|下)\s*[)）]/);
  if (ud && ud.index !== undefined && ud.index > 4) {
    const key = t.slice(0, ud.index).replace(/[\s:：\-–—,.]+$/, "").trim();
    if (key.length >= 6) return { key, no: ud[1] === "上" ? 1 : 2 };
  }

  return null;
}
