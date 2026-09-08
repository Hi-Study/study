"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostRow from "@/components/PostRow";
import { CompanyLogo } from "@/components/CompanyLogo";
import Icon from "@/components/Icon";
import {
  ARTICLE_KINDS, PROBLEM_TYPES, IMPACT_TARGETS, ARTICLE_FLAGS,
  type Company, type Post,
} from "@/lib/types";

// 홈 통계의 분류 축을 피드 필터로 그대로 쓴다.
// 한 축 안에서는 OR(여러 개 고르면 그중 아무거나), 축끼리는 AND.
const NONE = "__none__"; // problem_type 이 비어 있는 글
const CERTAINTIES = ["수치", "정성", "없음"];

type AxisKey = "kind" | "pt" | "it" | "rc" | "flag";
type Axis = { key: AxisKey; label: string; values: string[] };
const AXES: Axis[] = [
  { key: "kind", label: "글의 성격", values: [...ARTICLE_KINDS] },
  { key: "pt", label: "다룬 문제", values: [...PROBLEM_TYPES, NONE] },
  { key: "it", label: "무엇이 달라졌나", values: [...IMPACT_TARGETS] },
  { key: "rc", label: "결과", values: CERTAINTIES },
  { key: "flag", label: "플래그", values: [...ARTICLE_FLAGS] },
];

const matches = (p: Post, key: AxisKey, v: string): boolean => {
  switch (key) {
    case "kind": return p.article_kind === v;
    case "pt": return v === NONE ? !p.problem_type : p.problem_type === v;
    case "it": return !!p.impact_targets?.includes(v as never);
    case "rc": return p.result_certainty === v;
    case "flag": return !!p.flags?.includes(v as never);
  }
};

type Sel = Record<AxisKey, Set<string>>;
const emptySel = (): Sel => ({ kind: new Set(), pt: new Set(), it: new Set(), rc: new Set(), flag: new Set() });
const cloneSel = (s: Sel): Sel => ({
  kind: new Set(s.kind), pt: new Set(s.pt), it: new Set(s.it), rc: new Set(s.rc), flag: new Set(s.flag),
});
const selCount = (s: Sel) => AXES.reduce((n, a) => n + s[a.key].size, 0);

export default function FeedClient({
  posts, companies, bookmarked, readIds, favorites,
  initialTab = "all", initialSource = "all", initialClass,
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[]; favorites: string[];
  initialTab?: "all" | "bookmark"; initialSource?: string;
  initialClass?: Partial<Record<AxisKey, string[]>>;
}) {
  const initialCoId = initialSource !== "all" && initialSource !== "direct"
    ? companies.find((c) => c.slug === initialSource)?.id : undefined;
  const initialSel = (): Sel => {
    const s = emptySel();
    for (const a of AXES) (initialClass?.[a.key] ?? []).forEach((v) => s[a.key].add(v));
    return s;
  };

  const [tab, setTab] = useState<"all" | "bookmark">(initialTab);
  // 적용된 필터
  const [coSpecial, setCoSpecial] = useState<"all" | "favorites" | "direct">(initialSource === "direct" ? "direct" : "all");
  const [coIds, setCoIds] = useState<Set<string>>(new Set(initialCoId ? [initialCoId] : []));
  const [sel, setSel] = useState<Sel>(initialSel);
  const [favSet, setFavSet] = useState<Set<string>>(new Set(favorites));

  // 시트 초안 상태 — 적용을 눌러야 반영된다
  const [sheet, setSheet] = useState<"company" | "class" | null>(null);
  const [dSpecial, setDSpecial] = useState<"all" | "favorites" | "direct">("all");
  const [dCoIds, setDCoIds] = useState<Set<string>>(new Set());
  const [dSel, setDSel] = useState<Sel>(emptySel);

  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const openSheet = (t: "company" | "class") => {
    setDSpecial(coSpecial); setDCoIds(new Set(coIds)); setDSel(cloneSel(sel)); setSheet(t);
  };
  const apply = () => {
    setCoSpecial(dSpecial); setCoIds(new Set(dCoIds)); setSel(cloneSel(dSel)); setSheet(null);
  };
  const reset = () => {
    if (sheet === "company") { setDSpecial("all"); setDCoIds(new Set()); }
    else setDSel(emptySel());
  };

  const pickSpecial = (s: "all" | "favorites" | "direct") => { setDSpecial(s); setDCoIds(new Set()); };
  const toggleCo = (id: string) => setDCoIds((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    if (n.size) setDSpecial("all"); // 기업을 고르면 특수옵션 해제
    return n;
  });
  const toggleVal = (key: AxisKey, v: string) => setDSel((prev) => {
    const n = cloneSel(prev);
    if (n[key].has(v)) n[key].delete(v); else n[key].add(v);
    return n;
  });

  const toggleFav = async (companyId: string) => {
    const next = new Set(favSet);
    const on = !next.has(companyId);
    if (on) next.add(companyId); else next.delete(companyId);
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
  for (const a of AXES) {
    const picked = sel[a.key];
    if (picked.size) list = list.filter((p) => [...picked].some((v) => matches(p, a.key, v)));
  }

  const coCount = coIds.size || (coSpecial !== "all" ? 1 : 0);
  const coLabel = coIds.size
    ? `기업 · ${coIds.size}`
    : coSpecial === "favorites" ? "기업 · 즐겨찾기" : coSpecial === "direct" ? "기업 · 직접등록" : "기업";
  const clsCount = selCount(sel);
  const clsLabel = clsCount ? `분류 · ${clsCount}` : "분류";
  const label = (v: string) => (v === NONE ? "분류 안 됨" : v);

  const orderedCompanies = [...companies.filter((c) => favSet.has(c.id)), ...companies.filter((c) => !favSet.has(c.id))];

  return (
    <>
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

      <div className="cchips">
        <button className={`cchip sel-btn ${coCount ? "on" : ""}`} onClick={() => openSheet("company")}>
          {coLabel} <Icon name="chevron" size="sm" />
        </button>
        <button className={`cchip sel-btn ${clsCount ? "on" : ""}`} onClick={() => openSheet("class")}>
          {clsLabel} <Icon name="chevron" size="sm" />
        </button>
        <span className="cchip-n">{list.length}건</span>
      </div>

      <div style={{ height: 14 }} />
      {list.length ? (
        <div className="feed-list">
          {list.map((p) => <PostRow key={p.id} post={{ ...p, read: readSet.has(p.id), bookmarked: bmSet.has(p.id) }} />)}
        </div>
      ) : (
        <div className="empty"><div className="art" /><div className="msg">조건에 맞는 글이 없어요</div></div>
      )}

      {/* 필터 시트 */}
      {sheet && <div className="scrim show" onClick={() => setSheet(null)} />}
      <div className={`drawer ${sheet ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">
          {sheet === "class" ? "분류로 좁히기" : "기업"}
          <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setSheet(null)}><Icon name="x" /></button>
        </div>
        <div className="dbody" style={{ height: "58vh", overflowY: "auto" }}>
          {sheet === "class" ? (
            <div className="axis-wrap">
              {AXES.map((a) => (
                <div className="axis" key={a.key}>
                  <div className="axis-title">{a.label}</div>
                  <div className="chips wrap">
                    {a.values.map((v) => (
                      <button key={v} className={`chip ${dSel[a.key].has(v) ? "on" : ""}`} onClick={() => toggleVal(a.key, v)}>
                        {label(v)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="axis-note">
                같은 줄에서 여러 개를 고르면 그중 하나라도 맞는 글, 다른 줄끼리는 모두 맞는 글만 남아요.
              </p>
            </div>
          ) : (
            <>
              <div className="opt-row" onClick={() => pickSpecial("all")}>
                <span className={`radio ${dSpecial === "all" && !dCoIds.size ? "on" : ""}`} />
                <span className="opt-label">전체</span>
              </div>
              {favSet.size > 0 && (
                <div className="opt-row" onClick={() => pickSpecial("favorites")}>
                  <span className={`radio ${dSpecial === "favorites" ? "on" : ""}`} />
                  <span className="opt-label">★ 즐겨찾기</span>
                </div>
              )}
              <div className="opt-row" onClick={() => pickSpecial("direct")}>
                <span className={`radio ${dSpecial === "direct" ? "on" : ""}`} />
                <span className="opt-label">직접 등록</span>
              </div>

              <div className="sheet-divider" />

              {orderedCompanies.map((c) => {
                const on = dCoIds.has(c.id);
                return (
                  <div key={c.id} className="opt-row" onClick={() => toggleCo(c.id)}>
                    <span className={`checkbox ${on ? "on" : ""}`}>{on && <Icon name="check" size="sm" />}</span>
                    <CompanyLogo company={c} />
                    <span className="opt-label">{c.name}</span>
                    <button
                      className={`startoggle ${favSet.has(c.id) ? "on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }}
                      aria-label="즐겨찾기"
                    ><Icon name="star" /></button>
                  </div>
                );
              })}
            </>
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
