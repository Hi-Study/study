// AI 요약 실서버 검증 — 익명 로그인 → 스터디/텍스트 글 생성 → summarize 함수 호출 →
// ai_summary 가 (폴백이 아닌) 실제 LLM 요약으로 채워지는지 확인 → 정리.
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
  "좋은 기획서는 무엇을 넣을지가 아니라 무엇을 뺄지를 고민한 결과물이다.",
  "핵심 문제 정의, 목표 지표, 해결 범위 세 가지가 명확하면 나머지는 부차적이다.",
  "숫자가 부족한 초기 단계에서는 정성적 근거와 프로토타입으로 설득력을 만든다.",
  "문장으로 먼저 설득하고 숫자로 확인시키는 순서를 지키는 것이 중요하다.",
].join("\n");

async function main() {
  const { data: auth, error: aerr } = await supabase.auth.signInAnonymously();
  if (aerr) throw aerr;
  const uid = auth.user.id;
  console.log("✅ 익명 로그인 OK");

  const { data: sid, error: serr } = await supabase.rpc("create_study", {
    _name: "요약 테스트(자동삭제)", _description: null, _cadence: "주 2회",
  });
  if (serr) throw serr;

  const { data: share, error: shErr } = await supabase.from("shares").insert({
    study_id: sid, author_id: uid, kind: "text",
    day_of_week: 0, shared_date: "2026-07-22",
    title: "좋은 기획서의 조건", body: BODY,
  }).select("id").single();
  if (shErr) throw shErr;
  console.log("✅ 테스트 글 생성 OK");

  console.log("• summarize 함수 호출 중… (LLM 응답까지 몇 초)");
  const { data: res, error: fErr } = await supabase.functions.invoke("summarize", {
    body: { share_id: share.id },
  });
  if (fErr) {
    console.error("❌ summarize 호출 실패:", fErr.message);
  } else {
    const summary = res?.ai_summary ?? "";
    const isFallback = summary === "좋은 기획서의 조건" || summary.includes(" — ");
    console.log("\n── AI 요약 결과 ──");
    console.log(summary || "(비어 있음)");
    console.log("──────────────────");
    if (summary && !isFallback) {
      console.log("🎉 실제 AI 요약 생성 성공! (Groq 키 정상 작동)");
    } else {
      console.log("⚠️ 폴백 요약으로 보입니다 — Groq 키 미적용 또는 LLM 오류 가능. 함수 Logs 확인 필요.");
    }
  }

  await supabase.rpc("leave_study", { _study: sid });
  console.log("✅ 정리 완료(테스트 스터디 삭제)");
}

main().catch((e) => { console.error("❌ 예외:", e?.message ?? e); process.exit(1); });
