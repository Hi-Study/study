// notify-cron — 스케줄 알림 생성 (dev/api.md §5).
//   · discussion_pending: 이번 주 active 토론에 내 의견 없는 멤버
//   · cadence: 공유 주기 미달 멤버(주기 종료 시점)
// 계산 후 notifications insert (+ 추후 Expo Push 발송).
//
// 배포: supabase functions deploy notify-cron
// 스케줄: Supabase Dashboard > Edge Functions > Schedules(cron) 또는 pg_cron 으로
//   이 함수를 주기 호출. (예: 매일 21:00)
//
// ⚠️ 스텁: 주기 파싱/주차 계산/중복 방지 로직은 TODO. 골격만.
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

// "주 2회" / "매일 1회" → 주당 목표 횟수
function cadenceTarget(cadence: string): number {
  if (cadence.includes("매일")) return 7;
  const m = cadence.match(/(\d+)\s*회/);
  return m ? Number(m[1]) : 2;
}

// 이번 주 월요일(로컬 자정) ISO 'YYYY-MM-DD'
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function mondayOf(d: Date): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diff = (r.getUTCDay() + 6) % 7;
  r.setUTCDate(r.getUTCDate() - diff);
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = serviceClient();
    const now = new Date();
    const monday = mondayOf(now);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekStart = toISO(monday);
    const weekEnd = toISO(sunday);

    let inserted = 0;
    const rows: {
      user_id: string;
      type: string;
      study_id: string;
      ref_id: string | null;
      text: string;
    }[] = [];

    // 모든 스터디 + 멤버
    const { data: members } = await supabase
      .from("study_members")
      .select("study_id, user_id, studies(name, share_cadence)");
    const byStudy = new Map<string, { userIds: string[]; name: string; cadence: string }>();
    for (const m of members ?? []) {
      const s = (m as { studies?: { name: string; share_cadence: string } }).studies;
      const g = byStudy.get(m.study_id) ?? {
        userIds: [],
        name: s?.name ?? "",
        cadence: s?.share_cadence ?? "주 2회",
      };
      g.userIds.push(m.user_id);
      byStudy.set(m.study_id, g);
    }

    // 1) 미참여 토론: 이번 주 active 토론에 내 의견 없는 멤버
    const { data: discs } = await supabase
      .from("discussions")
      .select("id, study_id, title")
      .eq("is_active", true)
      .gte("week_start", weekStart)
      .lte("week_start", weekEnd);
    for (const d of discs ?? []) {
      const g = byStudy.get(d.study_id);
      if (!g) continue;
      const { data: commented } = await supabase
        .from("comments")
        .select("author_id")
        .eq("target_type", "discussion")
        .eq("target_id", d.id);
      const done = new Set((commented ?? []).map((c) => c.author_id));
      for (const uid of g.userIds) {
        if (done.has(uid)) continue;
        rows.push({
          user_id: uid,
          type: "discussion_pending",
          study_id: d.study_id,
          ref_id: d.id,
          text: `‘${d.title}’ 토론에 아직 의견을 남기지 않았어요`,
        });
      }
    }

    // 2) 공유 주기 미달: 이번 주 내 공유 수 < 목표
    const { data: shares } = await supabase
      .from("shares")
      .select("study_id, author_id")
      .gte("shared_date", weekStart)
      .lte("shared_date", weekEnd);
    const shareCount = new Map<string, number>(); // `${study}:${uid}` → n
    for (const s of shares ?? []) {
      const k = `${s.study_id}:${s.author_id}`;
      shareCount.set(k, (shareCount.get(k) ?? 0) + 1);
    }
    for (const [studyId, g] of byStudy) {
      const target = cadenceTarget(g.cadence);
      for (const uid of g.userIds) {
        const n = shareCount.get(`${studyId}:${uid}`) ?? 0;
        if (n < target) {
          rows.push({
            user_id: uid,
            type: "cadence",
            study_id: studyId,
            ref_id: null,
            text: `이번 주 공유 주기(${g.cadence})를 아직 채우지 못했어요`,
          });
        }
      }
    }

    // 중복 방지: 이번 주에 이미 보낸 같은 (user,type,ref) 는 건너뜀
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id, type, ref_id")
      .gte("created_at", `${weekStart}T00:00:00Z`);
    const seen = new Set((existing ?? []).map((e) => `${e.user_id}:${e.type}:${e.ref_id ?? ""}`));
    const fresh = rows.filter((r) => !seen.has(`${r.user_id}:${r.type}:${r.ref_id ?? ""}`));

    if (fresh.length > 0) {
      const { error } = await supabase.from("notifications").insert(fresh);
      if (error) return json({ error: error.message }, 500);
      inserted = fresh.length;
    }

    // TODO(다음): 각 user 의 Expo Push 토큰(별도 테이블)으로 푸시 발송.
    return json({ ok: true, weekStart, weekEnd, inserted });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
