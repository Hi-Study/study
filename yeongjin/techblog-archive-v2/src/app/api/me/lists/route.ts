import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/core/shared/auth";
import { getUserList, getUserLists, saveUserList } from "@/core/shared/db";
import { applyOp, parseOp } from "@/core/shared/list-ops";

/**
 * 내 목록(북마크·읽은 글·최근 검색어) — 로그인한 사람의 것만 읽고 쓴다. 화면 쪽: local-store.ts · AccountSync.tsx
 * - GET 로그인 안 함 → { userId: null } (오류가 아니라 정상 응답 — 콘솔에 빨간 줄이 안 뜨게). 화면이 이 브라우저 사본을 비운다
 * - 503: 서버 표(user_lists)가 아직 없음 → 화면은 예전처럼 브라우저에만 저장
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ userId: null }, { headers: { "Cache-Control": "no-store" } });
  const lists = await getUserLists(user.id);
  if (!lists) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ userId: user.id, lists }, { headers: { "Cache-Control": "no-store" } });
}

/** 바꾸기 한 건 — { key, op: toggle|add|clear|merge, ... }. 바꾼 뒤의 목록 전체를 돌려준다 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const op = parseOp(await req.json().catch(() => null));
  if (!op) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const items = applyOp(await getUserList(user.id, op.key), op);
    await saveUserList(user.id, op.key, items);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("[user_lists] 저장 실패", (e as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
