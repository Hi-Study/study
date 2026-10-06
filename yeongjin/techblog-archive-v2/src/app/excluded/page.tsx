import Link from "next/link";
import { connection } from "next/server";
import { CompanyBadge, formatDate } from "@/components/common/ArticleCard";
import { listArticles } from "@/core/shared/db";

export default async function ExcludedPage() {
  await connection();
  const rows = listArticles("excluded");
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">제외된 글</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">
        AI가 “순수 기술 구현 디테일이라 기획 관점이 부족하다”고 판단해 피드에서 뺀 글이에요. 판단이 틀릴 수 있어서 이유와 함께
        모두 공개해요.
      </p>
      <ul className="mt-6 space-y-3">
        {rows.map((a) => (
          <li key={a.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <CompanyBadge id={a.companyId} />
              <span className="text-xs text-ink-3">{formatDate(a.publishedAt)}</span>
            </div>
            <Link href={`/articles/${a.id}`} className="mt-1.5 block font-bold leading-snug hover:text-brand">
              {a.title}
            </Link>
            <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm leading-relaxed text-ink-2">
              <span className="mr-1.5 font-bold text-ink-3">제외 이유</span>
              {a.exclusionReason}
            </p>
          </li>
        ))}
        {rows.length === 0 && <p className="text-ink-3">제외된 글이 없어요.</p>}
      </ul>
    </div>
  );
}
