import { connection } from "next/server";
import { MyLists } from "@/components/common/MyLists";
import { requireUser } from "@/core/shared/auth";
import { listArticles } from "@/core/shared/db";
import { headlineOf } from "@/core/3-place/home";

export default async function MyPage() {
  await connection();
  const user = await requireUser("/my");
  // 북마크·읽은 글 id 는 브라우저가 계정에서 받아 오니(AccountSync), 목록 렌더에 필요한 최소 정보만 넘긴다
  const items = (await listArticles("included")).map((a) => ({
    id: a.id,
    companyId: a.companyId,
    title: a.title,
    hook: headlineOf(a),
    publishedAt: a.publishedAt,
  }));
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">마이</h1>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="min-w-0 truncate text-sm text-ink-2">
          <b className="text-ink">{user.email}</b> 로 로그인했어요
        </p>
        {/* 로그아웃은 POST 로만 — 링크 미리 불러오기로 로그아웃되지 않게 */}
        <form action="/auth/logout" method="post" className="shrink-0">
          <button className="text-sm font-semibold text-ink-3 transition hover:text-ink">로그아웃</button>
        </form>
      </div>
      <MyLists items={items} />
    </div>
  );
}
