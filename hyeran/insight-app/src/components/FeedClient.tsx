"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostRow from "@/components/PostRow";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import { CATEGORIES, type Category, type Company, type Post } from "@/lib/types";

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

  // 통합 필터 시트 (기업/카테고리 탭 분리, 한 시트에서 고르고 [적용])
  const [sheet, setSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<"company" | "category">("company");
  const [draftSource, setDraftSource] = useState("all");
  const [draftCats, setDraftCats] = useState<Set<Category>>(new Set());

  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const openSheet = (t: "company" | "category") => { setSheetTab(t); setDraftSource(source); setDraftCats(new Set(cats)); setSheet(true); };
  const apply = () => { setSource(draftSource); setCats(new Set(draftCats)); setSheet(false); };
  const reset = () => { setDraftSource("all"); setDraftCats(new Set()); };
  const toggleDraftCat = (c: Category) => { const n = new Set(draftCats); n.has(c) ? n.delete(c) : n.add(c); setDraftCats(n); };

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

  let list = posts;
  if (tab === "bookmark") list = list.filter((p) => bmSet.has(p.id));
  if (source === "direct") list = list.filter((p) => p.source === "direct");
  else if (source === "favorites") list = list.filter((p) => p.company_id && favSet.has(p.company_id));
  else if (source !== "all") list = list.filter((p) => p.company_id === source);
  if (cats.size) list = list.filter((p) => cats.has(p.category));

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "기업";
  const sourceLabel =
    source === "all" ? "기업"
    : source === "favorites" ? "기업 · 즐겨찾기"
    : source === "direct" ? "기업 · 직접등록"
    : `기업 · ${companyName(source)}`;
  const catLabel = cats.size === 0 ? "카테고리" : `카테고리 · ${cats.size}`;

  return (
    <>
      {/* 언더라인 탭 */}
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

      {/* 필터 — 항목 칩 2개(기업·카테고리) → 통합 셀렉트 시트(탭 분리) */}
      <div className="cchips">
        <button className={`cchip sel-btn ${source !== "all" ? "on" : ""}`} onClick={() => openSheet("company")}>{sourceLabel} <Icon name="chevron" size="sm" /></button>
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
          <button className={`utab ${sheetTab === "company" ? "on" : ""}`} onClick={() => setSheetTab("company")}>
            기업{draftSource !== "all" ? " ·" : ""}
          </button>
          <button className={`utab ${sheetTab === "category" ? "on" : ""}`} onClick={() => setSheetTab("category")}>
            카테고리{draftCats.size ? ` ${draftCats.size}` : ""}
          </button>
        </div>
        <div className="dbody" style={{ height: "58vh", overflowY: "auto" }}>
          {sheetTab === "company" ? (
            <>
              <button className="sheet-row" onClick={() => setDraftSource("all")}>
                <span className="sr-name">전체 기업</span>{draftSource === "all" && <Icon name="check" size="sm" />}
              </button>
              {favSet.size > 0 && (
                <button className="sheet-row" onClick={() => setDraftSource("favorites")}>
                  <span className="sr-name">★ 즐겨찾기만</span>{draftSource === "favorites" && <Icon name="check" size="sm" />}
                </button>
              )}
              <button className="sheet-row" onClick={() => setDraftSource("direct")}>
                <span className="sr-name">직접 등록</span>{draftSource === "direct" && <Icon name="check" size="sm" />}
              </button>
              {companies.map((c) => (
                <div key={c.id} className="sheet-row">
                  <span className="sr-tap" onClick={() => setDraftSource(c.id)}>
                    <CompanyLogo company={c} /><span className="sr-name">{c.name}</span>{draftSource === c.id && <Icon name="check" size="sm" />}
                  </span>
                  <button className={`startoggle ${favSet.has(c.id) ? "on" : ""}`} onClick={() => toggleFav(c.id)} aria-label="즐겨찾기"><Icon name="star" /></button>
                </div>
              ))}
            </>
          ) : (
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
                <button key={c} className={`cchip ${draftCats.has(c) ? "on" : ""}`} onClick={() => toggleDraftCat(c)}>{c}</button>
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
