"use client";

import { useMemo, useState } from "react";
import FeedCard from "@/components/FeedCard";
import { CATEGORIES, CAT_EN, readableText, type Category, type Company, type Post } from "@/lib/types";

type CompanyMode = "all" | "follow" | string; // string = company_id

export default function FeedClient({
  posts, companies, bookmarked, readIds, favorites, initialTab = "all", initialCompany = "all",
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[]; favorites: string[];
  initialTab?: "all" | "bookmark"; initialCompany?: CompanyMode;
}) {
  const [tab, setTab] = useState<"all" | "bookmark">(initialTab);
  const [company, setCompany] = useState<CompanyMode>(initialCompany);
  const [showAllCos, setShowAllCos] = useState(false);
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  let list = posts;
  if (tab === "bookmark") list = list.filter((p) => bmSet.has(p.id));
  if (company === "follow") list = list.filter((p) => p.company_id && favSet.has(p.company_id));
  else if (company !== "all") list = list.filter((p) => p.company_id === company);
  if (cats.size) list = list.filter((p) => cats.has(p.category));

  const toggleCat = (c: Category) => {
    const n = new Set(cats);
    n.has(c) ? n.delete(c) : n.add(c);
    setCats(n);
  };

  const empty = tab === "bookmark" && company === "all" && !cats.size
    ? "북마크한 글이 없어요"
    : "조건에 맞는 글이 없어요";

  return (
    <>
      {/* 언더라인 탭 */}
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

      {/* 기업 필터 칩 — 선택 시 브랜드색 채움, 비선택은 색 점 */}
      <div className="cchips">
        <button className={`cchip ${company === "all" ? "on" : ""}`} onClick={() => setCompany("all")}>All</button>
        <button className={`cchip ${company === "follow" ? "on" : ""}`} onClick={() => setCompany("follow")}>팔로우 중</button>
        {(showAllCos ? companies : companies.slice(0, 6)).map((c) => {
          const sel = company === c.id;
          return (
            <button
              key={c.id}
              className={`cchip brand ${sel ? "sel" : ""}`}
              style={sel ? { background: c.color, color: readableText(c.color), borderColor: "transparent" } : undefined}
              onClick={() => setCompany(sel ? "all" : c.id)}
            >
              {favSet.has(c.id) && <span className="cchip-star" style={{ color: sel ? readableText(c.color) : c.color }}>★</span>}
              {c.name}
            </button>
          );
        })}
        {!showAllCos && companies.length > 6 && (
          <button className="cchip more" onClick={() => setShowAllCos(true)}>더보기 +{companies.length - 6}</button>
        )}
      </div>

      {/* 카테고리 필터 칩 (영문, 아웃라인) */}
      <div className="katchips">
        {CATEGORIES.map((c) => (
          <button key={c} className={`katchip ${cats.has(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>
            {CAT_EN[c] ?? c}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="pop-grid">
          {list.map((p) => <FeedCard key={p.id} post={{ ...p, read: readSet.has(p.id), bookmarked: bmSet.has(p.id) }} />)}
        </div>
      ) : (
        <div className="empty"><div className="art" /><div className="msg">{empty}</div></div>
      )}
    </>
  );
}
