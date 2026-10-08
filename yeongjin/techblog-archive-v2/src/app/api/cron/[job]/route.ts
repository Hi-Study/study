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
  if (job === "collect") return Response.json(await autoCollect());
  if (job === "process") return Response.json(await autoProcess());
  return Response.json({ ok: false, error: "unknown job" }, { status: 404 });
}
