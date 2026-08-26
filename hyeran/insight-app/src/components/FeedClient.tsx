"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FeedCard from "@/components/FeedCard";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import DragScroll from "@/components/DragScroll";
import { CATEGORIES, readableText, type Category, type Company, type Post } from "@/lib/types";

// source: "all" | "favorites" | "direct" | companyId
export default function FeedClient({
  posts, companies, bookmarked, readIds, favorites, initialTab = "all", initialSource = "all", initialCategory = "",
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[]; favorites: string[];
  initialTab?: "all" | "bookmark"; initialSource?: string; initialCategory?: string;
}) {
  const [tab, setTab] = useState<"all" | "bookmark">(initialTab);
  const [source, setSource] = useState<string>(initialSource);
  const [cats, setCats] = useState<Set<Category>>(new Set(initialCategory ? [initialCategory as Category] : []));
  const [favSet, setFavSet] = useState<Set<string>>(new Set(favorites));
  const [coSheet, setCoSheet] = useState(false);
  const [catSheet, setCatSheet] = useState(false);
  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const toggleFav = async (companyId: string) => {
    const next = new Set(favSet);
    const on = !next.has(companyId);
    on ? next.add(companyId) : next.delete(companyId);
    setFavSet(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      if (on) await sb.from("favorites").insert({ user_id: user.id, company_id: companyId });
      else await sb.from("favorites").delete().eq("user_id", user.id).eq("company_id", companyId);
    }
  };
  const toggleCat = (c: Category) => {
    const n = new Set(cats); n.has(c) ? n.delete(c) : n.add(c); setCats(n);
  };

  let list = posts;
  if (tab === "bookmark") list = list.filter((p) => bmSet.has(p.id));
  if (source === "direct") list = list.filter((p) => p.source === "direct");
  else if (source === "favorites") list = list.filter((p) => p.company_id && favSet.has(p.company_id));
  else if (source !== "all") list = list.filter((p) => p.company_id === source);
  if (cats.size) list = list.filter((p) => cats.has(p.category));

  // 즐겨찾기 기업 먼저, 그다음 나머지
  const orderedCompanies = [...companies.filter((c) => favSet.has(c.id)), ...companies.filter((c) => !favSet.has(c.id))];
  const brandStyle = (c: Company) => ({ background: c.color, color: readableText(c.color), borderColor: "transparent" });

  return (
    <>
      {/* 언더라인 탭 */}
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

      {/* 필터 1줄 — 출처(기업) : 셀렉트 · 전체 · 즐겨찾기 · 직접등록 · 기업칩(즐겨찾기 먼저) */}
      <DragScroll className="cchips">
        <button className="cchip sel-btn" onClick={() => setCoSheet(true)}>기업 <Icon name="chevron" size="sm" /></button>
        <button className={`cchip ${source === "all" ? "on" : ""}`} onClick={() => setSource("all")}>전체</button>
        {favSet.size > 0 && (
          <button className={`cchip ${source === "favorites" ? "on" : ""}`} onClick={() => setSource(source === "favorites" ? "all" : "favorites")}>★ 즐겨찾기</button>
        )}
        <button className={`cchip ${source === "direct" ? "on" : ""}`} onClick={() => setSource(source === "direct" ? "all" : "direct")}>직접 등록</button>
        {orderedCompanies.map((c) => {
          const on = source === c.id;
          const fav = favSet.has(c.id);
          return (
            <button key={c.id} className={`cchip brand ${on ? "sel" : ""}`} style={on ? brandStyle(c) : undefined} onClick={() => setSource(on ? "all" : c.id)}>
              {fav && <span className="cchip-star" style={{ color: on ? readableText(c.color) : c.color }}>★</span>}{c.name}
            </button>
          );
        })}
      </DragScroll>

      {/* 필터 2줄 — 카테고리 : 셀렉트 · 전체 · 11개 칩 */}
      <DragScroll className="cchips" style={{ marginTop: 8 }}>
        <button className="cchip sel-btn" onClick={() => setCatSheet(true)}>카테고리 <Icon name="chevron" size="sm" /></button>
        <button className={`cchip ${cats.size === 0 ? "on" : ""}`} onClick={() => setCats(new Set())}>전체</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`cchip ${cats.has(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>{c}</button>
        ))}
      </DragScroll>

      <div style={{ height: 14 }} />
      {list.length ? (
        <div className="feed-list">
          {list.map((p) => <FeedCard key={p.id} post={{ ...p, read: readSet.has(p.id), bookmarked: bmSet.has(p.id) }} />)}
        </div>
      ) : (
        <div className="empty"><div className="art" /><div className="msg">조건에 맞는 글이 없어요</div></div>
      )}

      {/* 기업 선택 시트 (+ 즐겨찾기 설정) */}
      {coSheet && <div className="scrim show" onClick={() => setCoSheet(false)} />}
      <div className={`drawer ${coSheet ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">기업 선택<button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setCoSheet(false)}><Icon name="x" /></button></div>
        <div className="dbody">
          <button className="sheet-row" onClick={() => { setSource("all"); setCoSheet(false); }}>
            <span className="sr-name">전체 기업</span>{source === "all" && <Icon name="check" size="sm" />}
          </button>
          {companies.map((c) => (
            <div key={c.id} className="sheet-row">
              <span className="sr-tap" onClick={() => { setSource(c.id); setCoSheet(false); }}>
                <CompanyLogo company={c} /><span className="sr-name">{c.name}</span>
              </span>
              <button className={`startoggle ${favSet.has(c.id) ? "on" : ""}`} onClick={() => toggleFav(c.id)} aria-label="즐겨찾기"><Icon name="star" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* 카테고리 선택 시트 (다중) */}
      {catSheet && <div className="scrim show" onClick={() => setCatSheet(false)} />}
      <div className={`drawer ${catSheet ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">카테고리<button className="submit" onClick={() => setCatSheet(false)}>적용</button></div>
        <div className="dbody">
          {CATEGORIES.map((c) => (
            <button key={c} className="sheet-row" onClick={() => toggleCat(c)}>
              <span className="sr-name">{c}</span>{cats.has(c) && <Icon name="check" size="sm" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
