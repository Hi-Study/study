import { autoCollect, autoProcess } from "@/core/auto";

// 예약 작업이 부르는 주소: /api/cron/collect (하루 한 번) · /api/cron/process (15분마다)
// Authorization: Bearer <CRON_SECRET> 이 맞아야만 돈다 — 아무나 불러 AI 호출을 쓰지 못하게.
export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { job } = await ctx.params;
  try {
    if (job === "collect") return Response.json(await autoCollect());
    if (job === "process") return Response.json(await autoProcess());
    return Response.json({ ok: false, error: "unknown job" }, { status: 404 });
  } catch (e) {
    // 비밀값을 아는 호출자에게만 원인을 알려 준다(환경 변수 누락·잘못된 키 등 배포 설정 점검용).
    // 오류 문구에 키 값이 섞여 나올 수 있어(잘못 붙여 넣은 환경 변수 등) 비밀값은 가린다.
    const message = mask((e as Error).message);
    console.error(`[cron:${job}]`, message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

function mask(text: string): string {
  let out = text;
  for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "GEMINI_API_KEY", "CRON_SECRET"]) {
    for (const part of (process.env[name] ?? "").split(/\s+/)) if (part.length >= 8) out = out.split(part).join(`<${name}>`);
  }
  // 그 밖의 토큰 모양(JWT·긴 16진수)도 가린다
  return out.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<JWT>").replace(/\b[0-9a-f]{32,}\b/g, "<HEX>");
}
