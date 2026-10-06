import Link from "next/link";
import { companyById } from "@/core/0-collect/companies";
import { cls, headlineOf } from "@/core/3-place/home";
import { BENEFICIARY_LABEL, EXPERIENCE_META, INTERNAL_TAG, isInternal } from "@/core/2-classify/taxonomy";
import type { ArticleRow } from "@/core/shared/types";

export function CompanyBadge({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const c = companyById(id);
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-ink-2 ${size === "md" ? "text-sm" : "text-xs"}`}>
      <span className="size-2 rounded-full" style={{ background: c.color }} />
      {c.name}
    </span>
  );
}

/** 사내 운영자·개발자의 부담을 덜어준 경험이라는 표시 */
export function InternalTag({ who }: { who?: keyof typeof BENEFICIARY_LABEL }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-[#f1ecff] px-2 py-0.5 text-xs font-semibold text-[#5b3fd1]"
      title={who ? `${BENEFICIARY_LABEL[who]}의 부담을 덜어준 사례예요` : undefined}
    >
      🛠 {INTERNAL_TAG}
    </span>
  );
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ArticleCard({ a, showExperience = true }: { a: ArticleRow; showExperience?: boolean }) {
  const l = a.learning;
  const c = cls(a);
  const headline = headlineOf(a);
  return (
    <Link
      href={`/articles/${a.id}`}
      className="group block rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <CompanyBadge id={a.companyId} />
        <span className="text-xs text-ink-3">{formatDate(a.publishedAt)}</span>
      </div>
      <p className="text-[17px] font-bold leading-snug text-ink group-hover:text-brand">{headline}</p>
      {headline !== a.title && <p className="mt-1.5 line-clamp-1 text-sm text-ink-3">{a.title}</p>}
      {l && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {c && isInternal(c.beneficiary) && <InternalTag who={c.beneficiary} />}
          {showExperience && c?.experience && c.fit !== "NONE" && (
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              {EXPERIENCE_META[c.experience].emoji} {EXPERIENCE_META[c.experience].label.replace(" 경험", "")}
            </span>
          )}
          {c?.articleType && <span className="rounded-md bg-bg px-2 py-0.5 text-xs text-ink-2">{c.articleType}</span>}
          <span className="ml-auto text-xs text-ink-3">{l.readingTime}분</span>
        </div>
      )}
    </Link>
  );
}
