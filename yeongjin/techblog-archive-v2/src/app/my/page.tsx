import { connection } from "next/server";
import { MyLists } from "@/components/common/MyLists";
import { listArticles } from "@/core/shared/db";
import { headlineOf } from "@/core/3-place/home";

export default async function MyPage() {
  await connection();
  // 북마크·읽은 글 id 는 브라우저에만 있으니, 목록 렌더에 필요한 최소 정보만 넘긴다
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
      <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-brand">
        로그인 없이 쓰는 서비스라 저장한 글과 읽은 글은 <b>이 브라우저에만</b> 저장돼요. 다른 기기나 브라우저에서는 보이지 않고,
        브라우저 데이터를 지우면 함께 사라져요.
      </p>
      <MyLists items={items} />
    </div>
  );
}
