import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/core/shared/auth";

/** 마이의 "로그아웃" — 링크로 열리지 않게 POST 로만 받는다 */
export async function POST(req: NextRequest) {
  await (await authClient()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
