/**
 * 분류 판정 합치기 규칙 — 엣지 함수(`supabase/functions/_shared/classify.ts`)와 **같은 규칙**이다.
 *
 * ⚠️ 엣지(Deno)는 앱 소스를 import 할 수 없어 구현이 두 벌이다. 이 테스트는 규칙 자체가
 *    맞는지 고정해두는 용도다. 한쪽을 고치면 다른 쪽도 고치고 이 테스트를 다시 돌린다.
 *    (같은 이유로 supabase/functions/_shared/blocks.ts 도 src/lib/text.ts 의 사본이다.)
 */
type Topic = "quality_risk" | "ai_use" | "product_plan" | "data_exp" | "user_exp" | "biz_brand" | "collab";

interface Verdict {
  include: boolean;
  conclusion: string;
  topic: Topic | "";
  evidence: string;
  confidence: string;
}

function evidenceInBody(evidence: string, body: string): boolean {
  const e = evidence.replace(/\s+/g, "");
  if (e.length < 10) return false;
  return body.replace(/\s+/g, "").includes(e);
}

function majority(verdicts: Verdict[]): { topic: Topic | null; include: boolean } {
  const usable = verdicts.filter((v) => v.topic !== "");
  const excluded = verdicts.filter((v) => !v.include).length;
  if (verdicts.length > 0 && excluded * 2 > verdicts.length) return { topic: null, include: false };
  const count = new Map<string, number>();
  for (const v of usable) count.set(v.topic, (count.get(v.topic) ?? 0) + 1);
  let best: Topic | null = null;
  let bestN = 0;
  for (const [t, n] of count) {
    if (n > bestN) {
      best = t as Topic;
      bestN = n;
    }
  }
  return { topic: bestN >= 2 ? best : null, include: true };
}

const v = (topic: Topic | "", include = true): Verdict => ({
  include,
  conclusion: "c",
  topic,
  evidence: "e",
  confidence: "상",
});

describe("evidenceInBody — 근거 문장 본문 대조", () => {
  const body = "주문 목록을 여는 데\n3초가 넘게 걸린다는 제보가 늘었다.";

  it("본문에 있는 문장이면 통과한다", () => {
    expect(evidenceInBody("3초가 넘게 걸린다는 제보가 늘었다", body)).toBe(true);
  });

  it("줄바꿈·띄어쓰기만 다른 건 통과시킨다 — 그것까지 막으면 너무 빡빡하다", () => {
    expect(evidenceInBody("주문 목록을 여는 데 3초가", body)).toBe(true);
  });

  it("본문에 없는 문장(지어낸 근거)은 탈락", () => {
    expect(evidenceInBody("응답 속도를 10배 개선했다고 밝혔다", body)).toBe(false);
  });

  it("너무 짧은 근거는 인정하지 않는다 — 우연히 맞을 수 있다", () => {
    expect(evidenceInBody("주문", body)).toBe(false);
    expect(evidenceInBody("3초가", body)).toBe(false);
  });
});

describe("majority — 3회 판정 다수결", () => {
  it("두 번 이상 같으면 채택한다", () => {
    expect(majority([v("ai_use"), v("ai_use"), v("collab")])).toEqual({
      topic: "ai_use",
      include: true,
    });
  });

  it("셋 다 다르면 비워 둔다 — 흔들리는 글은 분류하지 않는 게 맞다", () => {
    expect(majority([v("ai_use"), v("collab"), v("data_exp")])).toEqual({
      topic: null,
      include: true,
    });
  });

  it("셋 다 같으면 당연히 채택", () => {
    expect(majority([v("user_exp"), v("user_exp"), v("user_exp")]).topic).toBe("user_exp");
  });

  it("과반이 '뺀다'면 제외로 간다", () => {
    expect(majority([v("", false), v("", false), v("collab")])).toEqual({
      topic: null,
      include: false,
    });
  });

  it("제외가 과반이 아니면 남은 판정으로 정한다", () => {
    expect(majority([v("", false), v("biz_brand"), v("biz_brand")])).toEqual({
      topic: "biz_brand",
      include: true,
    });
  });

  it("판정이 하나뿐이면 채택하지 않는다 — 다수결이 성립하지 않는다", () => {
    expect(majority([v("ai_use")]).topic).toBeNull();
  });

  it("판정이 없으면 비워 둔다", () => {
    expect(majority([])).toEqual({ topic: null, include: true });
  });
});
