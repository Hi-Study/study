// 분류 체계 v4 — 값 정의 · 프롬프트 · 판정  [분류체계_적용_지시서.md §2, §5]
// v3.2(category 4종 / problem_type 12종 / tech_level / subtitle_phrase)를 대체한다.

export const ARTICLE_KINDS = ["개선기", "소개", "조직·문화", "개념 설명", "소식"];

export const PROBLEM_TYPES = [
  // 사용자가 겪는 문제
  "이탈·전환", "탐색·발견", "온보딩·첫 경험", "일관성·디자인 시스템",
  "성능·속도", "장애·안정성", "보안·어뷰징", "미지원 기능",
  // 만드는 쪽이 겪는 문제
  "운영·어드민", "데이터 품질·계측", "확장·트래픽", "비용·효율",
  "레거시 전환", "개발 생산성", "사내 지식 접근", "판단 기준 부재", "AI 출력 통제",
];

export const IMPACT_TARGETS = ["사용자 경험", "내부 생산성", "자원·비용", "비즈니스 성과"];
export const CERTAINTIES = ["수치", "정성", "없음"];
export const FLAGS = ["기대와 다른 결과", "직접 만들기", "개발 과정에 AI"];

// 정렬용 — 같은 섹션 안에서 수치 > 정성 > 없음 (§2-4)
export const certaintyRank = (c) => (c === "수치" ? 0 : c === "정성" ? 1 : 2);

// 본문 → 프롬프트 텍스트. 코드 블록은 자리표시자로 줄인다.
// 한도가 8,000자였을 때 판정 대상의 46%가 결과 문단을 잘린 채 판정됐다.
export function bodyToText(body, limit = 30000) {
  const out = [];
  for (const b of Array.isArray(body) ? body : []) {
    if (typeof b !== "string" || b.startsWith("::img::")) continue;
    out.push(b.startsWith("::code::") ? "[코드 블록]" : b.replace(/^::[a-z0-9]+::/, ""));
  }
  return out.join("\n").slice(0, limit);
}

// ── 프롬프트 (§5 그대로) ──────────────────────────────────────
export function buildPrompt(title, text) {
  return `아래 글을 읽고 분류·요약·헤드라인을 만들어라.

【article_kind】 아래 5개 중 하나.
  개선기      문제를 정의하고 풀어낸 기록
  소개        시스템·도구가 이렇게 생겼다는 개괄
  조직·문화    일하는 방식, 팀 구성, 사내 행사
  개념 설명    원리·방법론 설명, 아직 진행 중인 고민
  소식        출간·공지 등

【problem_type】 이 글이 다룬 문제. 아래 17개 중 하나.
어디에도 해당하지 않으면 null. 억지로 밀어넣지 마라.

  이탈·전환            사용자가 중간에 떠나거나 목표 행동에 도달하지 못함
  탐색·발견            원하는 것을 찾지 못함 (검색·추천·정보구조)
  온보딩·첫 경험        처음 쓰는 사람의 진입 장벽
  일관성·디자인 시스템   화면과 경험이 제각각이라 생기는 문제
  성능·속도            느려서 생긴 문제
  장애·안정성           터지거나 데이터가 깨짐
  보안·어뷰징           계정 도용·사기·공격 등 악의적 사용
  미지원 기능           지원하는 방법이 없어 사용자가 아예 못 하던 일
  운영·어드민           내부 운영자의 수작업·비효율
  데이터 품질·계측       지표를 믿을 수 없거나 측정 자체가 안 됨
  확장·트래픽           규모가 커지며 한계에 부딪힘
  비용·효율            인프라·운영 비용
  레거시 전환           오래된 시스템·구조를 바꾸는 일
  개발 생산성           팀의 개발·배포 속도, 협업 방식
  사내 지식 접근        필요한 정보가 흩어져 있거나 특정 사람만 알고 있음
  판단 기준 부재        같은 상황에서 사람마다 다른 결정을 내림
  AI 출력 통제         LLM 결과가 일정하지 않거나 근거를 확인할 수 없음

  경계 규칙:
    지표를 못 믿으면 데이터 품질·계측 / 모델 출력을 못 믿으면 AI 출력 통제
    불편한 사람이 운영자면 운영·어드민 / 개발팀이면 개발 생산성
    결과물이 제각각이면 일관성·디자인 시스템 / 결정 자체가 안 서면 판단 기준 부재
    이미 깨졌으면 장애·안정성 / 아직 안 깨졌는데 막는 거면 보안·어뷰징

【impact_targets】 무엇이 달라졌나. 해당하는 것을 모두. 없으면 빈 배열.

  ★ 사용자 경험과 내부 생산성을 가르는 기준은 "누구에게 달라졌나" 하나다.
    여기서 사용자는 그 회사 제품·서비스를 쓰는 외부 고객, 즉 직원이 아닌 사람이다.
    사내 직원·팀·개발자에게 달라진 것은 사용자 경험이 아니라 내부 생산성이다.
    사내 도구·사내 플랫폼·업무 자동화 글은 쓰는 사람이 아무리 많아도
    그 사람들이 직원이라면 내부 생산성이다. 사용자 경험을 붙이지 마라.

  사용자 경험     외부 고객이 하는 일이나 느끼는 것이 달라짐
                (앱 화면, 가입·구매 흐름, 검색 결과, 배송, 고객 문의 등)
  내부 생산성     사내 직원·팀의 일이 줄거나 빨라짐
                (사내 도구, 배포, 코드 리뷰, 운영 수작업, 사내 지식 등)
  자원·비용      인프라 비용, 자원 사용량
  비즈니스 성과   전환·매출·규모 (외부 고객이 만들어낸 결과)

【result_certainty】 결과를 어떻게 말하고 있나. 셋 중 하나.
  수치   전/후 숫자가 본문에 있다
  정성   달라진 건 말했는데 숫자가 없다
  없음   무엇이 달라졌는지 자체가 없다

【flags】 해당하는 것을 모두. 없으면 빈 배열.
  기대와 다른 결과   실패했거나, 지표가 안 움직였거나, 일부만 해결됐다고
                   본문이 스스로 밝힌 경우
  직접 만들기       상용 도구·외부 서비스·기존 라이브러리를 검토하고 버린 뒤
                   직접 만든 경우
  개발 과정에 AI    제품에 AI 기능을 붙인 게 아니라, 만드는 과정에서
                   AI를 도구로 쓴 경우

【요약 4문항】 각 답변 2~3문장, 구어체(~어요).

  problem         이 팀이 무엇을 문제로 보았는가
  decision        무엇을 택하고 무엇을 버렸는가.
                  ★ 검토했다 버린 대안이나 이번에 하지 않고 미룬 것이
                    원문에 있으면 반드시 함께 쓴다. 이것이 이 필드의 핵심이다.
  implementation  실제로 무엇을 만들거나 바꿨는가
  impact          그래서 무엇이 달라졌는가.
                  근거가 없으면 null. 빈칸을 채우려고 만들어내지 마라.

  article_kind가 개선기가 아니면 problem·decision·implementation도
  본문에 없을 수 있다. 없으면 null로 두어라.

【headline】 카드에 쓸 우리 제목. 원제목과 다른 문장이어야 한다.

  형식: 25자 안팎, 구어체 ~어요로 끝낸다.
  규칙: 회사 내부 용어를 쓰지 마라 — 그 회사를 모르는 사람이 읽고
        무슨 상황인지 알 수 있어야 한다.
        결과가 본문에 있으면 결과까지 넣어라.
        원제목을 그대로 옮기지 마라. 제목은 카드에 이미 있다.
        본문에 없는 수치나 결과를 지어내지 마라.
  예시: "수십 개 계정을 하나씩 클릭하던 차단 작업이 7초가 됐어요"
        "코드를 모르던 담당자가 AI로 사내 플랫폼을 만들었어요"
        "네 번 실험해서 세 번은 지표가 안 움직였어요"

【terms】 이 글을 읽기 전에 알면 좋은 용어 최대 3개.
  각각 {term, description} — description은 한 문장, 구어체.
  꼭 필요하지 않으면 빈 배열.

【출력】
{
  "article_kind": "개선기|소개|조직·문화|개념 설명|소식",
  "problem_type": "..." | null,
  "impact_targets": ["..."],
  "result_certainty": "수치|정성|없음",
  "flags": ["..."],
  "ai_summary": {
    "problem": "..." | null,
    "decision": "..." | null,
    "implementation": "..." | null,
    "impact": "..." | null
  },
  "headline": "...",
  "terms": [{ "term": "...", "description": "..." }]
}

제목: ${title}
본문:
${text}`;
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const pickAll = (v, allowed) => (Array.isArray(v) ? v.filter((x) => allowed.includes(x)) : []);

// ── 판정 1건 ──────────────────────────────────────────────────
export async function classify({ title, body, model }) {
  let ai = null;
  // 일시적 네트워크 오류로 한 번에 포기하면 멀쩡한 글이 미판정으로 남는다
  for (let attempt = 1; attempt <= 3 && !ai; attempt++) {
    try {
      const res = await model.generateContent(buildPrompt(title, bodyToText(body)));
      ai = JSON.parse(res.response.text());
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  if (!ai) return { ok: false };

  const s = ai.ai_summary || {};
  const impact = str(s.impact);
  let certainty = CERTAINTIES.includes(ai.result_certainty) ? ai.result_certainty : "없음";
  // §3 정합성: impact 가 null 이면 result_certainty 도 '없음' 이어야 한다
  if (!impact) certainty = "없음";

  return {
    ok: true,
    article_kind: ARTICLE_KINDS.includes(ai.article_kind) ? ai.article_kind : "개선기",
    problem_type: PROBLEM_TYPES.includes(ai.problem_type) ? ai.problem_type : null,
    impact_targets: pickAll(ai.impact_targets, IMPACT_TARGETS),
    result_certainty: certainty,
    flags: pickAll(ai.flags, FLAGS),
    headline: str(ai.headline),
    terms: Array.isArray(ai.terms)
      ? ai.terms.filter((t) => t && str(t.term)).slice(0, 3)
          .map((t) => ({ term: String(t.term).trim(), description: String(t.description ?? "").trim() }))
      : [],
    ai_summary: {
      problem: str(s.problem),
      decision: str(s.decision),
      implementation: str(s.implementation),
      impact,
    },
  };
}
