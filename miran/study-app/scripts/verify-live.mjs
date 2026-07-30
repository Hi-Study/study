// 실서버 검증: 3모드 요약(원문요약/기획자관점/쉽게풀기) + 링크 원문 추출.
// 테스트용 스터디 생성 후 자동 삭제. 실행: node scripts/verify-live.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const BODY = [
  "AI 코딩 도구가 개발과 디자인을 빠르게 대체하면서, 사람이 해야 할 일은 무엇을 만들지 정의하는 기획으로 옮겨간다.",
  "기획은 문제를 정의하고 우선순위를 정하며 사용자의 진짜 니즈를 발견하는 과정이다.",
  "AI가 실행을 맡을수록 방향 설정(무엇을 왜 만드는가)의 가치는 오히려 커진다.",
  "따라서 앞으로의 경쟁력은 도구를 다루는 능력보다 좋은 질문을 던지고 맥락을 읽는 기획 역량에서 나온다.",
].join("\n");
const LINK = "https://oliveyoung.tech/2026-07-14/building-integrated-backoffice-with-vue-web-components/";

async function main() {
  const { data: auth, error: aerr } = await supabase.auth.signInAnonymously();
  if (aerr) throw aerr;
  const uid = auth.user.id;
  console.log("✅ 익명 로그인");

  const { data: sid, error: serr } = await supabase.rpc("create_study", {
    _name: "검증(자동삭제)", _description: null, _cadence: "주 2회",
  });
  if (serr) throw serr;

  try {
    // ── 1) 텍스트 글: 3모드 요약 ──
    const { data: share, error: e1 } = await supabase.from("shares").insert({
      study_id: sid, author_id: uid, kind: "text", day_of_week: 0,
      shared_date: "2026-07-22", title: "AI 시대의 기획", body: BODY,
    }).select("id").single();
    if (e1) throw e1;
    console.log("\n════════ 1) 공유 글 AI 요약 3모드");
    for (const mode of ["plain", "planner", "explain"]) {
      const { data, error } = await supabase.functions.invoke("summarize", { body: { share_id: share.id, mode } });
      if (error) { console.log(`[${mode}] ❌ ${error.message}`); continue; }
      const sum = data?.summary ?? data?.ai_summary ?? "(없음)";
      console.log(`\n[${mode}] (${sum.length}자)\n${sum.slice(0, 240)}`);
    }
    const { data: sRow } = await supabase.from("shares").select("ai_summaries").eq("id", share.id).single();
    console.log("\n저장된 ai_summaries 키:", Object.keys(sRow?.ai_summaries ?? {}));

    // ── 2) 링크 글: 원문 추출 ──
    console.log("\n════════ 2) 링크 원문 추출 (oliveyoung)");
    const { data: link, error: e2 } = await supabase.from("shares").insert({
      study_id: sid, author_id: uid, kind: "link", day_of_week: 0,
      shared_date: "2026-07-22", title: "링크 검증", url: LINK,
    }).select("id").single();
    if (e2) throw e2;
    const og = await supabase.functions.invoke("og-preview", { body: { share_id: link.id, url: LINK } });
    console.log("og-preview 응답:", JSON.stringify(og.data ?? og.error?.message));
    const { data: lRow } = await supabase.from("shares")
      .select("article_text, source, og_description").eq("id", link.id).single();
    console.log("source:", lRow?.source);
    console.log("article_text 길이:", lRow?.article_text?.length ?? 0, "자");
    console.log("본문 앞 180자:", (lRow?.article_text ?? "(없음)").slice(0, 180).replace(/\n/g, " "));
    const linkSum = await supabase.functions.invoke("summarize", { body: { share_id: link.id, mode: "plain" } });
    console.log("링크 요약:", (linkSum.data?.summary ?? linkSum.error?.message ?? "").slice(0, 180));
  } finally {
    await supabase.rpc("leave_study", { _study: sid });
    console.log("\n✅ 정리 완료(테스트 스터디 삭제)");
  }
}
main().catch((e) => { console.error("❌ 예외:", e?.message ?? e); process.exit(1); });
