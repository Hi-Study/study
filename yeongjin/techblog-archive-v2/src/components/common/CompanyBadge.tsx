import { companyById } from "@/core/0-collect/companies";

/**
 * 회사 표시 — 흰 원 안의 로고 + 회사 이름. 글 카드·피드 회사 필터·마이·제외된 글이 같이 쓴다.
 * 로고 경로는 서버에서 companyLogo(id) 로 찾아 넘긴다(파일 시스템을 읽어서 브라우저 쪽 코드에서는 못 부른다).
 * 로고 파일이 없으면 회사 색 첫 글자로 대신한다.
 */
export function CompanyBadge({ id, logo, size = "sm" }: { id: string; logo: string | null; size?: "sm" | "md" }) {
  const c = companyById(id);
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-ink-2 ${size === "md" ? "text-sm" : "text-xs"}`}>
      <CompanyLogo id={id} logo={logo} />
      {c.name}
    </span>
  );
}

/** 흰 원 안의 회사 로고 — 칩처럼 이름을 따로 그리는 곳은 이것만 쓴다 */
export function CompanyLogo({ id, logo }: { id: string; logo: string | null }) {
  const c = companyById(id);
  return (
    <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-3.5 object-contain" />
      ) : (
        <span className="text-[10px] font-bold" style={{ color: c.color }}>
          {c.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
