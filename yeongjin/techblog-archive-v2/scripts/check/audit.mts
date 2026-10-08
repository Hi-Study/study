import "../_env.mts";
import { companyById } from "../../src/core/0-collect/companies";
import { listArticles } from "../../src/core/shared/db";
import { cls, headlineOf } from "../../src/core/3-place/home";
import { BURDENS, EXPERIENCE_META, EXPERIENCES, isInternal, type ExperienceKey } from "../../src/core/2-classify/taxonomy";

// 사용: npm run audit — 경험 분류가 어떻게 나뉘었는지 점검
const rows = await listArticles("included");
const line = (a: (typeof rows)[number]) => {
  const c = cls(a)!;
  return (
    `  - [${companyById(a.companyId).name}] ${headlineOf(a)}  (v${c.version ?? 1} · ${c.fit}` +
    `${c.primarySection ? ` · 칸${c.primarySection}` : ""}${isInternal(c.beneficiary) ? ` · 🛠${c.beneficiary}` : ""})` +
    (c.review?.length ? `\n      ? ${c.review.join("\n      ? ")}` : "")
  );
};

for (const k of EXPERIENCES as readonly ExperienceKey[]) {
  const list = rows.filter((a) => cls(a)?.experience === k);
  const strong = list.filter((a) => cls(a)!.fit === "STRONG");
  console.log(`\n## ${EXPERIENCE_META[k].label} — STRONG ${strong.length} (사용자 ${strong.filter((a) => !isInternal(cls(a)!.beneficiary)).length}) / WEAK ${list.length - strong.length}`);
  for (const a of list) console.log(line(a));
}
const none = rows.filter((a) => cls(a)?.fit === "NONE");
console.log(`\n## 해당 없음 — ${none.length}`);
for (const a of none) console.log(`  - [${companyById(a.companyId).name}] ${headlineOf(a)}  (${cls(a)!.articleType})`);

const missingNew = rows.filter((a) => !a.learning?.classification).length;
const noHeadline = rows.filter((a) => !a.learning?.cardHeadline).length;
console.log(`\n글 ${rows.length}건 · 새 분류 없음 ${missingNew} · 카드 문장 없음(원제목 사용) ${noHeadline}`);
console.log(`부담 종류 ${BURDENS.length}개 · 사내 운영·개발 ${rows.filter((a) => isInternal(cls(a)?.beneficiary)).length}건`);
