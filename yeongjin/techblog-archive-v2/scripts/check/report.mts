import "../_env.mts";
import { COMPANIES, companyById } from "../../src/core/0-collect/companies";
import { db } from "../../src/core/shared/db";

// 사용: npm run report — 회사별 수집·포함·제외·대기 건수와 제외 이유 목록
type Row = { company_id: string; status: string; n: number };
const rows = db().prepare("SELECT company_id, status, COUNT(*) n FROM articles GROUP BY company_id, status").all() as Row[];

const by = new Map<string, Record<string, number>>();
for (const r of rows) {
  if (!by.has(r.company_id)) by.set(r.company_id, { included: 0, excluded: 0, pending: 0 });
  by.get(r.company_id)![r.status] = r.n;
}

console.log("| 회사 | 수집 | 포함 | 제외 | 대기 |\n|---|---|---|---|---|");
const total = { all: 0, included: 0, excluded: 0, pending: 0 };
for (const c of COMPANIES) {
  const s = by.get(c.id) ?? { included: 0, excluded: 0, pending: 0 };
  const all = s.included + s.excluded + s.pending;
  total.all += all;
  total.included += s.included;
  total.excluded += s.excluded;
  total.pending += s.pending;
  console.log(`| ${c.name} | ${all} | ${s.included} | ${s.excluded} | ${s.pending} |`);
}
console.log(`| **합계 (${COMPANIES.length}곳 중 ${[...by.keys()].length}곳)** | **${total.all}** | **${total.included}** | **${total.excluded}** | **${total.pending}** |`);

console.log("\n## 제외된 글");
const ex = db()
  .prepare("SELECT id, company_id, title, exclusion_reason FROM articles WHERE status='excluded' ORDER BY company_id")
  .all() as { id: number; company_id: string; title: string; exclusion_reason: string }[];
for (const e of ex) console.log(`- #${e.id} [${companyById(e.company_id).name}] ${e.title}\n    → ${e.exclusion_reason}`);
const pend = db().prepare("SELECT id, company_id, title FROM articles WHERE status='pending'").all() as {
  id: number;
  company_id: string;
  title: string;
}[];
if (pend.length) {
  console.log("\n## 분석 대기");
  for (const p of pend) console.log(`- #${p.id} [${companyById(p.company_id).name}] ${p.title}`);
}
