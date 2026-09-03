// 한국어 조사 선택 — 받침 유무로 갈린다.
//
// 문장을 조립해서 보여주는 곳(질문 1개, 개선 한 줄 요약)이 여러 군데라 여기로 모았다.
// 안 맞추면 "올리브영는 왜…", "대조을 골랐을까요?" 처럼 바로 티가 난다(실측).

/** 받침이 있으면 true. 한글이 아닌 끝(영문·숫자)은 false 로 본다. */
export function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 끝 글자의 받침이 ㄹ 인지 — "~로/으로" 를 가르는 데 필요하다. */
function endsWithRieul(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8; // 종성 인덱스 8 = ㄹ
}

/** 주격 — 받침 있으면 "은", 없으면 "는". */
export function subjectParticle(word: string): "은" | "는" {
  return hasFinalConsonant(word) ? "은" : "는";
}

/** 목적격 — 받침 있으면 "을", 없으면 "를". */
export function objectParticle(word: string): "을" | "를" {
  return hasFinalConsonant(word) ? "을" : "를";
}

/**
 * 도구격 — "~로 / ~으로".
 * 받침이 없거나 ㄹ 받침이면 "로", 그 외에는 "으로".
 * (예: 모노리포**로**, 도입**으로**, 파일**로**)
 */
export function instrumentalParticle(word: string): "로" | "으로" {
  if (!hasFinalConsonant(word)) return "로";
  return endsWithRieul(word) ? "로" : "으로";
}
