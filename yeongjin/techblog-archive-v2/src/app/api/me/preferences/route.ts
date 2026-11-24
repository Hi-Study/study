import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/core/shared/auth";
import { getUserPreferences, saveUserPreferences } from "@/core/shared/db";
import { ROLES } from "@/core/3-place/onboarding";
import type { OnboardingStatus } from "@/core/shared/types";

const STATUSES: OnboardingStatus[] = ["not_started", "in_progress", "completed", "skipped"];

/**
 * 직군별 개인화 온보딩 설정 — 로그인한 사람의 것만 읽고 쓴다. 화면 쪽: OnboardingFlow.tsx · my/page.tsx
 * - GET 로그인 안 함 → { userId: null } (오류가 아니라 정상 응답). GET /api/me/lists 와 같은 모양을 쓴다.
 * - 503: 서버 표(user_preferences)가 아직 없음(스키마 SQL을 아직 안 돌림) → 화면은 온보딩 선택을 세션에만 담고 넘어간다
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ userId: null }, { headers: { "Cache-Control": "no-store" } });
  const prefs = await getUserPreferences(user.id);
  if (!prefs) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ userId: user.id, prefs }, { headers: { "Cache-Control": "no-store" } });
}

function parsePatch(body: unknown): { role?: string; interests?: string[]; onboardingStatus?: OnboardingStatus } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const out: { role?: string; interests?: string[]; onboardingStatus?: OnboardingStatus } = {};
  if (o.role !== undefined) {
    if (typeof o.role !== "string" || !ROLES.includes(o.role as never)) return null;
    out.role = o.role;
  }
  if (o.interests !== undefined) {
    if (!Array.isArray(o.interests) || !o.interests.every((i) => typeof i === "string")) return null;
    out.interests = o.interests.slice(0, 20);
  }
  if (o.onboardingStatus !== undefined) {
    if (!STATUSES.includes(o.onboardingStatus as OnboardingStatus)) return null;
    out.onboardingStatus = o.onboardingStatus as OnboardingStatus;
  }
  return out;
}

/** 부분 패치 한 건 — { role?, interests?, onboardingStatus? }. 로그인하지 않았으면 401 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const patch = parsePatch(await req.json().catch(() => null));
  if (!patch) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await saveUserPreferences(user.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[user_preferences] 저장 실패", (e as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
