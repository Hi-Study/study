"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { CompanyLogo } from "@/components/PostCard";
import type { Company } from "@/lib/types";

// 기업 상세 상단: 현재 기업명(셀렉트) → 탭 시 다른 기업으로 전환. favorite = 기업명 옆 즐겨찾기 슬롯
export default function CompanySelect({ current, companies, favIds = [], favorite }: { current: Company; companies: Company[]; favIds?: string[]; favorite?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const favSet = new Set(favIds);
  const go = (slug: string) => {
    setOpen(false);
    if (slug !== current.slug) router.push(`/companies/${slug}`);
  };
  return (
    <>
      <span className="co-select" role="button" tabIndex={0} onClick={() => setOpen(true)}>
        <CompanyLogo company={current} />
        <span className="co-select-name">{current.name}</span>
        {favorite}
        <span className="co-chev" onClick={() => setOpen(true)}><Icon name="chevron" /></span>
      </span>

      {open && <div className="scrim show" onClick={() => setOpen(false)} />}
      <div className={`drawer ${open ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">기업 선택<button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}><Icon name="x" /></button></div>
        <div className="dbody">
          {companies.map((c) => (
            <button key={c.id} className="sheet-row" onClick={() => go(c.slug)}>
              <CompanyLogo company={c} />
              <span className="sr-name">{c.name}{favSet.has(c.id) && <span className="sr-fav">★</span>}</span>
              {c.slug === current.slug && <Icon name="check" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
