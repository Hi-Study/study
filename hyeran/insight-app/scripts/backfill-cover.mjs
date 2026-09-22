// posts.cover_image 백필 [마이그레이션 015]
// body 의 첫 ::img:: 를 컬럼으로 옮긴다. AI 호출 없음.
//   node scripts/backfill-cover.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const { data, error } = await sb.from("posts").select("id, body");
if (error) { console.log("조회 실패:", error.message); process.exit(1); }

let filled = 0, none = 0, failed = 0;
for (const p of data) {
  const img = (p.body || []).find((s) => typeof s === "string" && s.startsWith("::img::"));
  const url = img ? img.slice("::img::".length) : null;
  if (!url) none++;
  const { error: e } = await sb.from("posts").update({ cover_image: url }).eq("id", p.id);
  if (e) { console.log("  ✗", e.message); failed++; } else if (url) filled++;
}
console.log(`완료 — 커버 있음 ${filled} · 없음 ${none}` + (failed ? ` · 실패 ${failed}` : ""));
