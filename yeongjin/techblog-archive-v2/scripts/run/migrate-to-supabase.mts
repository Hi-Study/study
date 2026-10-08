import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { log } from "../_env.mts";
import { sb } from "../../src/core/shared/db";

// 사용: npm run migrate-to-supabase [-- data/app.db]
// 로컬 SQLite(data/app.db)의 글을 Supabase 로 id 그대로 옮긴다. 같은 id 가 이미 있으면 덮어쓴다(여러 번 실행해도 안전).
// 먼저 supabase/schema.sql 을 Supabase SQL Editor 에서 실행해 두어야 한다.
const file = process.argv[2] ?? "data/app.db";
if (!fs.existsSync(file)) {
  log(`✗ ${file} 이 없어요.`);
  process.exit(1);
}
type Raw = {
  id: number;
  company_id: string;
  title: string;
  url: string;
  published_at: string;
  content_html: string;
  status: string;
  exclusion_reason: string | null;
  learning_json: string | null;
  reading_guide_json: string | null;
  thumbnail_url: string | null;
  created_at: string;
};
const rows = new DatabaseSync(file, { readOnly: true }).prepare("SELECT * FROM articles ORDER BY id").all() as Raw[];
log(`옮길 글 ${rows.length}건`);

const BATCH = 20;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH).map((r) => ({
    id: r.id,
    company_id: r.company_id,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    content_html: r.content_html,
    status: r.status,
    exclusion_reason: r.exclusion_reason,
    learning: r.learning_json ? JSON.parse(r.learning_json) : null,
    reading_guide: r.reading_guide_json ? JSON.parse(r.reading_guide_json) : null,
    thumbnail_url: r.thumbnail_url,
    // SQLite datetime('now') 는 UTC 인데 시간대 표기가 없다
    created_at: r.created_at.includes("T") ? r.created_at : `${r.created_at.replace(" ", "T")}Z`,
  }));
  const { error } = await sb().from("articles").upsert(chunk, { onConflict: "id" });
  if (error) {
    log(`✗ ${i + 1}~${i + chunk.length}번째: ${error.message}`);
    process.exit(1);
  }
  log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
const { error } = await sb().rpc("reset_articles_id_seq");
if (error) log(`✗ 번호 이어 붙이기 실패: ${error.message}`);

// 확인 — 상태별 건수가 로컬과 같은지
const local: Record<string, number> = {};
for (const r of rows) local[r.status] = (local[r.status] ?? 0) + 1;
for (const s of Object.keys(local)) {
  const res = await sb().from("articles").select("id", { count: "exact", head: true }).eq("status", s);
  log(`${res.count === local[s] ? "✓" : "✗"} ${s}: 로컬 ${local[s]} · Supabase ${res.count}`);
}
