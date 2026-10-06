import Link from "next/link";
import { connection } from "next/server";
import { ArticleCard } from "@/components/common/ArticleCard";
import { companyById } from "@/core/0-collect/companies";
import { listArticles } from "@/core/shared/db";
import { allTags } from "@/core/3-place/home";

const AUDIENCES = ["PM", "기획자", "디자이너", "데이터분석가", "프로덕트오너"];

type Filter = { company?: string; tag?: string; audience?: string };

function href(cur: Filter, key: keyof Filter, value: string) {
  const next = { ...cur, [key]: cur[key] === value ? undefined : value };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/feed?${qs}` : "/feed";
}

function Chip({ on, to, children }: { on: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm transition ${
        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-ink-3"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  await connection();
  const sp = await searchParams;
  const f: Filter = {
    company: typeof sp.company === "string" ? sp.company : undefined,
    tag: typeof sp.tag === "string" ? sp.tag : undefined,
    audience: typeof sp.audience === "string" ? sp.audience : undefined,
  };
  const all = listArticles("included");
  const companies = [...new Set(all.map((a) => a.companyId))];
  const tags = allTags(all, 24);
  const rows = all.filter(
    (a) =>
      (!f.company || a.companyId === f.company) &&
      (!f.tag || a.learning?.tags.includes(f.tag)) &&
      (!f.audience || a.learning?.audience === f.audience),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">피드</h1>
      <p className="mt-1 text-sm text-ink-3">기획 관점이 있는 글만 최신순으로 모았어요</p>

      <div className="mt-6 space-y-3">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
          <span className="w-10 shrink-0 self-center text-xs font-bold text-ink-3">회사</span>
          {companies.map((c) => (
            <Chip key={c} on={f.company === c} to={href(f, "company", c)}>
              {companyById(c).name}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
          <span className="w-10 shrink-0 self-center text-xs font-bold text-ink-3">직무</span>
          {AUDIENCES.map((a) => (
            <Chip key={a} on={f.audience === a} to={href(f, "audience", a)}>
              {a}
            </Chip>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
          <span className="w-10 shrink-0 self-center text-xs font-bold text-ink-3">태그</span>
          {tags.map((t) => (
            <Chip key={t.label} on={f.tag === t.label} to={href(f, "tag", t.label)}>
              #{t.label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-ink-3">
        {rows.length}건
        {(f.company || f.tag || f.audience) && (
          <Link href="/feed" className="ml-2 font-semibold text-brand">
            필터 초기화
          </Link>
        )}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}
