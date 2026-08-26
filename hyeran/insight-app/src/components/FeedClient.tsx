"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostRow from "@/components/PostRow";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import { CATEGORIES, type Category, type Company, type Post } from "@/lib/types";

export default function FeedClient({
  posts, companies, bookmarked, readIds, favorites, initialTab = "all", initialSource = "all", initialCategory = "",
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[]; favorites: string[];
  initialTab?: "all" | "bookmark"; initialSource?: string; initialCategory?: string;
}) {
  const initialCoId = initialSource !== "all" && initialSource !== "direct"
    ? companies.find((c) => c.slug === initialSource)?.id : undefined;

  const [tab, setTab] = useState<"all" | "bookmark">(initialTab);
  // 적용된 필터
  const [coSpecial, setCoSpecial] = useState<"all" | "favorites" | "direct">(initialSource === "direct" ? "direct" : "all");
  const [coIds, setCoIds] = useState<Set<string>>(new Set(initialCoId ? [initialCoId] : []));
  const [cats, setCats] = useState<Set<Category>>(new Set(initialCategory ? [initialCategory as Category] : []));
  const [favSet, setFavSet] = useState<Set<string>>(new Set(favorites));

  // 시트 (기업/카테고리 탭, 초안 상태)
  const [sheet, setSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<"company" | "category">("company");
  const [dSpecial, setDSpecial] = useState<"all" | "favorites" | "direct">("all");
  const [dCoIds, setDCoIds] = useState<Set<string>>(new Set());
  const [dCats, setDCats] = useState<Set<Category>>(new Set());

  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const openSheet = (t: "company" | "category") => {
    setSheetTab(t); setDSpecial(coSpecial); setDCoIds(new Set(coIds)); setDCats(new Set(cats)); setSheet(true);
  };
  const apply = () => { setCoSpecial(dSpecial); setCoIds(new Set(dCoIds)); setCats(new Set(dCats)); setSheet(false); };
  const reset = () => { setDSpecial("all"); setDCoIds(new Set()); setDCats(new Set()); };

  const pickSpecial = (s: "all" | "favorites" | "direct") => { setDSpecial(s); setDCoIds(new Set()); };
  const toggleCo = (id: string) => setDCoIds((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
    if (n.size) setDSpecial("all"); // 기업 고르면 특수옵션 해제
    return n;
  });
  const toggleDCat = (c: Category) => setDCats((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });

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

  // 필터 적용
  let list = posts;
  if (tab === "bookmark") list = list.filter((p) => bmSet.has(p.id));
  if (coIds.size) list = list.filter((p) => p.company_id && coIds.has(p.company_id));
  else if (coSpecial === "direct") list = list.filter((p) => p.source === "direct");
  else if (coSpecial === "favorites") list = list.filter((p) => p.company_id && favSet.has(p.company_id));
  if (cats.size) list = list.filter((p) => cats.has(p.category));

  const coCount = coIds.size || (coSpecial !== "all" ? 1 : 0);
  const dCoCount = dCoIds.size || (dSpecial !== "all" ? 1 : 0);
  const coLabel = coIds.size ? `기업 · ${coIds.size}` : coSpecial === "favorites" ? "기업 · 즐겨찾기" : coSpecial === "direct" ? "기업 · 직접등록" : "기업";
  const catLabel = cats.size ? `카테고리 · ${cats.size}` : "카테고리";

  // 즐겨찾기 기업 먼저
  const orderedCompanies = [...companies.filter((c) => favSet.has(c.id)), ...companies.filter((c) => !favSet.has(c.id))];

  return (
    <>
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

      <div className="cchips">
        <button className={`cchip sel-btn ${coCount ? "on" : ""}`} onClick={() => openSheet("company")}>{coLabel} <Icon name="chevron" size="sm" /></button>
        <button className={`cchip sel-btn ${cats.size ? "on" : ""}`} onClick={() => openSheet("category")}>{catLabel} <Icon name="chevron" size="sm" /></button>
      </div>

      <div style={{ height: 14 }} />
      {list.length ? (
        <div className="feed-list">
          {list.map((p) => <PostRow key={p.id} post={{ ...p, read: readSet.has(p.id), bookmarked: bmSet.has(p.id) }} />)}
        </div>
      ) : (
        <div className="empty"><div className="art" /><div className="msg">조건에 맞는 글이 없어요</div></div>
      )}

      {/* 통합 필터 시트 */}
      {sheet && <div className="scrim show" onClick={() => setSheet(false)} />}
      <div className={`drawer ${sheet ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">필터<button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setSheet(false)}><Icon name="x" /></button></div>
        <div className="utabs" style={{ margin: "0 15px 4px" }}>
          <button className={`utab ${sheetTab === "company" ? "on" : ""}`} onClick={() => setSheetTab("company")}>기업{dCoCount ? ` ${dCoCount}` : ""}</button>
          <button className={`utab ${sheetTab === "category" ? "on" : ""}`} onClick={() => setSheetTab("category")}>카테고리{dCats.size ? ` ${dCats.size}` : ""}</button>
        </div>
        <div className="dbody" style={{ height: "58vh", overflowY: "auto" }}>
          {sheetTab === "company" ? (
            <>
              <button className={`sheet-row ${dSpecial === "all" && !dCoIds.size ? "sel" : ""}`} onClick={() => pickSpecial("all")}>
                <span className="sr-name">전체</span>{dSpecial === "all" && !dCoIds.size && <Icon name="check" size="sm" />}
              </button>
              {favSet.size > 0 && (
                <button className={`sheet-row ${dSpecial === "favorites" ? "sel" : ""}`} onClick={() => pickSpecial("favorites")}>
                  <span className="sr-name">★ 즐겨찾기</span>{dSpecial === "favorites" && <Icon name="check" size="sm" />}
                </button>
              )}
              <button className={`sheet-row ${dSpecial === "direct" ? "sel" : ""}`} onClick={() => pickSpecial("direct")}>
                <span className="sr-name">직접 등록</span>{dSpecial === "direct" && <Icon name="check" size="sm" />}
              </button>

              <div className="sheet-divider" />

              {orderedCompanies.map((c) => {
                const sel = dCoIds.has(c.id);
                return (
                  <div key={c.id} className={`sheet-row co-opt ${sel ? "sel" : ""}`} onClick={() => toggleCo(c.id)}>
                    <CompanyLogo company={c} />
                    <span className="sr-name">{c.name}</span>
                    <button className={`startoggle ${favSet.has(c.id) ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }} aria-label="즐겨찾기"><Icon name="star" /></button>
                    <span style={{ flex: 1 }} />
                    <span className={`co-check ${sel ? "on" : ""}`}>{sel && <Icon name="check" size="sm" />}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
                <button key={c} className={`cchip ${dCats.has(c) ? "on" : ""}`} onClick={() => toggleDCat(c)}>{c}</button>
              ))}
            </div>
          )}
        </div>
        <div className="dfoot">
          <button className="ghost" onClick={reset}>초기화</button>
          <button className="submit" onClick={apply}>적용</button>
        </div>
      </div>
    </>
  );
}
