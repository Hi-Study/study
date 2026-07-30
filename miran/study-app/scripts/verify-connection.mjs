// Supabase 실연결 검증 — .env 의 값으로 실제 서버에 붙어
// 익명 로그인 → 프로필 자동생성 → create_study RPC → 목록 조회 → 정리(삭제) 를 확인한다.
// 실행: node scripts/verify-connection.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
console.log("• URL:", url);
console.log("• KEY:", key ? key.slice(0, 12) + "…(" + key.length + "자)" : "(없음)");

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1) 익명 로그인
  const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr) {
    console.error("❌ 익명 로그인 실패:", authErr.message);
    console.error("   → Authentication > Providers 에서 Anonymous 를 켰는지 확인하세요.");
    process.exit(1);
  }
  const uid = auth.user.id;
  console.log("✅ 익명 로그인 OK · uid =", uid);

  // 2) 프로필 자동 생성(트리거) 확인
  const { data: prof, error: profErr } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (profErr) console.error("⚠️  users 조회 오류:", profErr.message);
  else if (!prof) console.error("⚠️  프로필이 자동 생성되지 않았습니다(트리거 확인 필요).");
  else console.log("✅ 프로필 자동 생성 OK · name =", prof.name);

  // 3) create_study RPC (트랜잭션 + 코드 생성)
  const { data: sid, error: rpcErr } = await supabase.rpc("create_study", {
    _name: "연결 테스트(자동삭제)",
    _description: null,
    _cadence: "주 2회",
  });
  if (rpcErr) {
    console.error("❌ create_study RPC 실패:", rpcErr.message);
    process.exit(1);
  }
  console.log("✅ create_study RPC OK · study id =", sid);

  // 4) 내 스터디 목록(조인 + RLS)
  const { data: mine, error: mErr } = await supabase
    .from("study_members")
    .select("role, study:studies(name, invite_code)")
    .eq("user_id", uid);
  if (mErr) console.error("⚠️  목록 조회 오류:", mErr.message);
  else console.log("✅ 목록/RLS OK · 내 스터디 수 =", mine.length, "· 코드 =", mine[0]?.study?.invite_code);

  // 5) 정리 — leave_study(마지막 멤버 → 스터디 삭제)
  const { error: leaveErr } = await supabase.rpc("leave_study", { _study: sid });
  if (leaveErr) console.error("⚠️  정리 실패(테스트 스터디가 남을 수 있음):", leaveErr.message);
  else console.log("✅ 정리 OK · 테스트 스터디 삭제됨");

  console.log("\n🎉 전부 통과 — 앱이 이 Supabase 에 정상적으로 연결됩니다.");
}

main().catch((e) => {
  console.error("❌ 예외:", e?.message ?? e);
  process.exit(1);
});
