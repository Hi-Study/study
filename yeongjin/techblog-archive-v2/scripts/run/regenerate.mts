import fs from "node:fs";
import path from "node:path";
import { log } from "../_env.mts";
import { getArticle, listArticles, markExcluded } from "../../src/core/shared/db";
import { hasGeminiKey } from "../../src/core/shared/ai";
import { htmlToText, splitBlocks } from "../../src/core/0-collect/content";
import { gateArticle } from "../../src/core/1-analyze/analyze";
import { rebuildIncluded } from "../../src/core/pipeline";

// 사용: npm run regenerate
// 입력 제한을 없앤 뒤(2026-10-07) 이미 모은 글 전체를 한 번 다시 만든다.
//   1) 모든 글: 배제 판정을 본문 전체로 다시
//   2) 포함된 글: 예전 14,000자 제한을 넘던 글은 상세 분석 다시 · 예전 가이드가 뒤쪽 블록을 못 봤던 글은 가이드 다시 · 분류(v4)는 전부 다시
//   새로 포함된 글은 처음부터(분석 → 가이드 → 분류)
// 무료 키 하루 한도(PerDay)에 걸리면 멈춘다. 진행 상황은 data/logs/regenerate-v4.json 에 남아 같은 명령으로 이어서 돈다.
if (!hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요.");
  process.exit(1);
}

const PROGRESS = path.join("data", "logs", "regenerate-v4.json");
type Progress = {
  gated: Record<number, { before: string; include: boolean; reason: string }>;
  rebuilt: number[];
};
fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
const p: Progress = fs.existsSync(PROGRESS)
  ? JSON.parse(fs.readFileSync(PROGRESS, "utf8"))
  : { gated: {}, rebuilt: [] };
const save = () => fs.writeFileSync(PROGRESS, JSON.stringify(p, null, 2));

/** 예전 가이드 1단계 입력(블록당 140자 · 전체 5,000자)이 뒤쪽 블록을 잘랐는가 */
function oldGuideTruncated(html: string): boolean {
  const blocks = splitBlocks(html);
  let budget = 5000;
  let seen = 0;
  for (const b of blocks) {
    const len = `[${b.n}] ${b.text.slice(0, 140)}`.length;
    if (budget - len < 0) break;
    budget -= len;
    seen++;
  }
  return seen < blocks.length;
}

const stopIfDaily = (e: unknown, done: string) => {
  const msg = (e as Error).message;
  if (/PerDay/.test(msg)) {
    save();
    log(`■ 무료 키 하루 한도에 걸려 멈춰요. ${done} — 한도가 풀리면(한국 오후 4~5시) 'npm run regenerate' 로 이어서 돌리세요.`);
    process.exit(2);
  }
  return msg.slice(0, 200);
};

const all = [...(await listArticles("included", { content: true })), ...(await listArticles("excluded", { content: true })), ...(await listArticles("pending", { content: true }))];

// 1) 배제 판정 — 본문 전체
const toGate = all.filter((a) => !p.gated[a.id]);
log(`1) 배제 판정 다시 ${toGate.length}건 (전체 ${all.length}건 중)`);
for (const a of toGate) {
  try {
    const g = await gateArticle(a.title, htmlToText(a.contentHtml));
    p.gated[a.id] = { before: a.status, include: g.include, reason: g.reason };
    save();
    const now = g.include ? "included" : "excluded";
    if (now !== a.status) log(`  ⇄ #${a.id} ${a.status} → ${now}: ${a.title} — ${g.reason}`);
  } catch (e) {
    log(`  ✗ #${a.id} ${stopIfDaily(e, `판정 ${Object.keys(p.gated).length}/${all.length}건 완료`)}`);
  }
}

const flipsOf = () => Object.entries(p.gated).filter(([, g]) => (g.include ? "included" : "excluded") !== g.before);
if (process.argv.includes("--gate-only")) {
  // 판정만 보고 DB 는 건드리지 않는다
  const f = flipsOf();
  log(`\n판정만 — 포함/제외가 바뀔 글 ${f.length}건`);
  for (const [id, g] of f) log(`  ${g.before} → ${g.include ? "included" : "excluded"} #${id} ${(await getArticle(Number(id)))?.title} — ${g.reason}`);
  process.exit(0);
}

// 2) 판정 반영 + 포함된 글 다시 만들기
const ids = all.map((a) => a.id).filter((id) => p.gated[id]);
// 제외 판정은 이미 다시 만든 글에도 반영한다(판정 기준을 고친 뒤 판정만 다시 돌린 경우)
for (const id of ids) if (!p.gated[id].include && p.rebuilt.includes(id)) p.rebuilt = p.rebuilt.filter((x) => x !== id);
const todo = ids.filter((id) => !p.rebuilt.includes(id));
log(`2) 다시 만들기 ${todo.length}건`);
for (const id of todo) {
  const a = (await getArticle(id))!;
  const g = p.gated[id];
  try {
    if (!g.include) {
      await markExcluded(id, g.reason); // 원래 제외였던 글도 제외 사유를 본문 전체 기준으로 바꾼다
    } else if (a.status !== "included" || !a.learning) {
      log(`  ＋ 새로 포함 #${id} ${a.title}`);
      // 판정은 위에서 했으니 분석부터 (pipeline.classify 는 판정부터 다시 돈다)
      await rebuildIncluded(id, { reanalyze: true, reguide: true }, log);
    } else {
      const text = htmlToText(a.contentHtml);
      const reanalyze = text.length > 14000;
      const reguide = !a.guide || oldGuideTruncated(a.contentHtml);
      log(`  ↻ #${id} ${a.title}${reanalyze ? " · 분석" : ""}${reguide ? " · 가이드" : ""} · 분류`);
      await rebuildIncluded(id, { reanalyze, reguide }, log);
    }
    p.rebuilt.push(id);
    save();
  } catch (e) {
    log(`  ✗ #${id} ${stopIfDaily(e, `다시 만들기 ${p.rebuilt.length}/${ids.length}건 완료`)}`);
  }
}

const flips = flipsOf();
log(`\n완료 — 판정 ${Object.keys(p.gated).length}건, 다시 만든 글 ${p.rebuilt.length}건, 포함/제외가 바뀐 글 ${flips.length}건`);
