"use client";

import { useMemo, useState } from "react";
import PostRow from "@/components/PostRow";
import Icon from "@/components/Icon";
import {
  ARTICLE_KINDS, PROBLEM_TYPES, IMPACT_TARGETS, ARTICLE_FLAGS,
  type Company, type Post,
} from "@/lib/types";

// 필터는 축 하나로 다룬다 — 기업도 분류의 한 축일 뿐이다.
// 한 축 안에서는 OR(여러 개 고르면 그중 아무거나), 축끼리는 AND.
// 아무것도 안 고르면 전체가 기본값이다.
const NONE = "__none__"; // problem_type 이 비어 있는 글
const CERTAINTIES = ["수치", "정성", "없음"];

type AxisKey = "co" | "kind" | "pt" | "it" | "rc" | "flag";
type Axis = { key: AxisKey; label: string; values: string[] };

const CLASS_AXES: Axis[] = [
  { key: "kind", label: "글의 성격", values: [...ARTICLE_KINDS] },
  { key: "pt", label: "다룬 문제", values: [...PROBLEM_TYPES, NONE] },
  { key: "it", label: "무엇이 달라졌나", values: [...IMPACT_TARGETS] },
  { key: "rc", label: "결과", values: CERTAINTIES },
  { key: "flag", label: "플래그", values: [...ARTICLE_FLAGS] },
];
const ALL_KEYS: AxisKey[] = ["co", "kind", "pt", "it", "rc", "flag"];

const matches = (p: Post, key: AxisKey, v: string): boolean => {
  switch (key) {
    case "co": return p.company_id === v;
    case "kind": return p.article_kind === v;
    case "pt": return v === NONE ? !p.problem_type : p.problem_type === v;
    case "it": return !!p.impact_targets?.includes(v as never);
    case "rc": return p.result_certainty === v;
    case "flag": return !!p.flags?.includes(v as never);
  }
};

type Sel = Record<AxisKey, Set<string>>;
const emptySel = (): Sel =>
  Object.fromEntries(ALL_KEYS.map((k) => [k, new Set<string>()])) as Sel;
const cloneSel = (s: Sel): Sel =>
  Object.fromEntries(ALL_KEYS.map((k) => [k, new Set(s[k])])) as Sel;
const countOf = (s: Sel, keys: AxisKey[]) => keys.reduce((n, k) => n + s[k].size, 0);
const PAGE = 40;

export default function FeedClient({
  posts, companies, bookmarked, readIds, initialSource = "all", initialClass,
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[];
  initialSource?: string;
  initialClass?: Partial<Record<AxisKey, string[]>>;
}) {
  const initialSel = (): Sel => {
    const s = emptySel();
    for (const k of ALL_KEYS) (initialClass?.[k] ?? []).forEach((v) => s[k].add(v));
    const co = companies.find((c) => c.slug === initialSource);
    if (co) s.co.add(co.id);
    return s;
  };

  const [sel, setSel] = useState<Sel>(initialSel);
  // 313건을 한 번에 그리면 스크롤이 무겁다. 필요한 만큼만 그린다
  const [shown, setShown] = useState(PAGE);

  // 시트 초안 — 적용을 눌러야 반영된다
  const [sheet, setSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<"company" | "class">("company");
  const [draft, setDraft] = useState<Sel>(emptySel);

  const bmSet = useMemo(() => new Set(bookmarked), [bookmarked]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const open = () => { setDraft(cloneSel(sel)); setSheet(true); };
  const apply = () => { setSel(cloneSel(draft)); setShown(PAGE); setSheet(false); };
  // 초기화는 지금 보고 있는 탭만 지운다
  const reset = () => setDraft((prev) => {
    const n = cloneSel(prev);
    if (sheetTab === "company") n.co = new Set();
    else CLASS_AXES.forEach((a) => (n[a.key] = new Set()));
    return n;
  });
  const toggle = (key: AxisKey, v: string) => setDraft((prev) => {
    const n = cloneSel(prev);
    if (n[key].has(v)) n[key].delete(v); else n[key].add(v);
    return n;
  });

  // 필터 적용
  let list = posts;
  for (const k of ALL_KEYS) {
    const picked = sel[k];
    if (picked.size) list = list.filter((p) => [...picked].some((v) => matches(p, k, v)));
  }

  const total = countOf(sel, ALL_KEYS);
  const label = (v: string) => (v === NONE ? "분류 안 됨" : v);
  const dCo = countOf(draft, ["co"]);
  const dCls = countOf(draft, ["kind", "pt", "it", "rc", "flag"]);

  return (
    <>
      <div className="cchips">
        <button className={`cchip sel-btn ${total ? "on" : ""}`} onClick={open}>
          {total ? `필터 · ${total}` : "필터"} <Icon name="chevron" size="sm" />
        </button>
        <span className="cchip-n">{list.length}건</span>
      </div>

      <div style={{ height: 14 }} />
      {list.length ? (
        <>
          <div className="feed-list">
            {list.slice(0, shown).map((p) => (
              <PostRow key={p.id} post={{ ...p, read: readSet.has(p.id), bookmarked: bmSet.has(p.id) }} />
            ))}
          </div>
          {shown < list.length && (
            <button className="more-btn" onClick={() => setShown((n) => n + PAGE)}>
              {list.length - shown}건 더 보기
            </button>
          )}
        </>
      ) : (
        <div className="empty"><div className="art" /><div className="msg">조건에 맞는 글이 없어요</div></div>
      )}

      {/* 필터 시트 — 기업 · 분류 두 탭을 한 자리에서 다룬다 */}
      {sheet && <div className="scrim show" onClick={() => setSheet(false)} />}
      <div className={`drawer ${sheet ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">
          필터
          <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setSheet(false)}><Icon name="x" /></button>
        </div>
        <div className="utabs" style={{ margin: "0 15px 6px" }}>
          <button className={`utab ${sheetTab === "company" ? "on" : ""}`} onClick={() => setSheetTab("company")}>
            기업{dCo ? ` ${dCo}` : ""}
          </button>
          <button className={`utab ${sheetTab === "class" ? "on" : ""}`} onClick={() => setSheetTab("class")}>
            분류{dCls ? ` ${dCls}` : ""}
          </button>
        </div>
        <div className="dbody" style={{ height: "56vh", overflowY: "auto" }}>
          <div className="axis-wrap">
            {sheetTab === "company" ? (
              <div className="axis">
                <div className="axis-title">출처 {companies.length}곳</div>
                <div className="chips wrap">
                  {companies.map((c) => (
                    <button key={c.id} className={`chip ${draft.co.has(c.id) ? "on" : ""}`} onClick={() => toggle("co", c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              CLASS_AXES.map((a) => (
                <div className="axis" key={a.key}>
                  <div className="axis-title">{a.label}</div>
                  <div className="chips wrap">
                    {a.values.map((v) => (
                      <button key={v} className={`chip ${draft[a.key].has(v) ? "on" : ""}`} onClick={() => toggle(a.key, v)}>
                        {label(v)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
            <p className="axis-note">
              아무것도 안 고르면 전체예요. 같은 줄에서 여러 개를 고르면 그중 하나라도 맞는 글,
              다른 줄끼리는 모두 맞는 글만 남아요.
            </p>
          </div>
        </div>
        <div className="dfoot">
          <button className="ghost" onClick={reset}>초기화</button>
          <button className="submit" onClick={apply}>적용</button>
        </div>
      </div>
    </>
  );
}
