import { log } from "../_env.mts";
import { validateDetailV2 } from "../../src/core/1-analyze/detail-v2";
import { allowNumbersFor, arg, readJsonl, type InputLine, type OutputLine } from "../run/_detail-v2-io.mts";

// 사용: npm run validate-detail-v2 [-- --input=data/detail-v2/output.jsonl --source=data/detail-v2/input.jsonl]
// Claude Code 결과를 DB 없이 검사한다 — 입력·출력 ID 맞춤, 중복, JSON 오류, validateDetailV2.
// 한 건이라도 걸리면 종료 코드 1.
const outFile = arg("input") ?? "data/detail-v2/output.jsonl";
const srcFile = arg("source") ?? "data/detail-v2/input.jsonl";

const src = readJsonl<InputLine>(srcFile);
const out = readJsonl<OutputLine>(outFile);
const problems: string[] = [...src.errors.map((e) => `입력 ${e}`), ...out.errors.map((e) => `출력 ${e}`)];

const byId = new Map(src.rows.map((r) => [r.id, r]));
const seen = new Set<number>();
let passed = 0;
for (const o of out.rows) {
  if (seen.has(o.id)) {
    problems.push(`#${o.id} 출력 중복`);
    continue;
  }
  seen.add(o.id);
  const s = byId.get(o.id);
  if (!s) {
    problems.push(`#${o.id} 입력에 없는 ID`);
    continue;
  }
  const errs = validateDetailV2(o.detail, s.text, allowNumbersFor(o.id));
  if (errs.length) problems.push(`#${o.id} ${errs.join(" / ")}`);
  else passed++;
}
const missing = src.rows.filter((r) => !seen.has(r.id)).map((r) => r.id);
if (missing.length) problems.push(`출력 누락 ID: ${missing.join(",")}`);

log(`통과 ${passed}건 / 출력 ${out.rows.length}건 / 입력 ${src.rows.length}건`);
for (const p of problems) log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
