import { NextResponse, type NextRequest } from "next/server";
import { companyLogo } from "@/core/0-collect/logos";
import { listArticles } from "@/core/shared/db";
import { recommendFor, ROLES, type Role } from "@/core/3-place/onboarding";

/**
 * STEP 04 — 선택한 직군·관심사로 추천 글을 고른다. 전체 글 목록을 클라이언트로 내려보내지 않고 서버에서만 계산한다.
 * Server Action("use server") 대신 이 저장소의 기존 관례(/api/me/lists 와 같은 평범한 라우트 핸들러)를 따른다 —
 * 클라이언트 컴포넌트가 service_role 키를 쓰는 db.ts 를 Server Action 경유로 부르면 Turbopack 이
 * "the chunking context does not support external modules (request: node:fs)" 로 패닉하는 문제가 있었다.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const role = body?.role;
  const interests = Array.isArray(body?.interests) ? body.interests.filter((i: unknown) => typeof i === "string") : [];
  if (typeof role !== "string" || !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const rows = await listArticles("included");
  const recommendations = recommendFor(rows, role as Role, interests, 3).map((r) => ({
    ...r,
    logo: companyLogo(r.article.companyId),
  }));
  return NextResponse.json({ recommendations }, { headers: { "Cache-Control": "no-store" } });
}
