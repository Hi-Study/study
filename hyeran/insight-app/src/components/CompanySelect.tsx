"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { CompanyLogo } from "@/components/PostCard";
import type { Company } from "@/lib/types";

// 기업 상세 상단: 현재 기업명(셀렉트) → 탭 시 다른 기업으로 전환
export default function CompanySelect({ current, companies }: { current: Company; companies: Company[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const go = (slug: string) => {
    setOpen(false);
    if (slug !== current.slug) router.push(`/companies/${slug}`);
  };
  return (
    <>
      <button className="co-select" onClick={() => setOpen(true)}>
        <CompanyLogo company={current} />
        <span className="co-select-name">{current.name}</span>
        <Icon name="chevron" />
      </button>

      {open && <div className="scrim show" onClick={() => setOpen(false)} />}
      <div className={`drawer ${open ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">기업 선택<button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}><Icon name="x" /></button></div>
        <div className="dbody">
          {companies.map((c) => (
            <button key={c.id} className="sheet-row" onClick={() => go(c.slug)}>
              <CompanyLogo company={c} />
              <span className="sr-name">{c.name}</span>
              {c.slug === current.slug && <Icon name="check" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
