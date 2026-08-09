"use client";

import { useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import Icon from "@/components/Icon";
import type { Company, Post } from "@/lib/types";

const RISING = ["OKR", "리텐션", "온보딩", "디자인시스템", "RAG", "LLM", "실험", "생산성", "아키텍처", "AI"];
const KEY = "recent-searches";

export default function SearchClient({ posts, companies }: { posts: Post[]; companies: Company[] }) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
  }, []);

  const saveRecent = (term: string) => {
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };
  const removeRecent = (term: string) => {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  const compName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  const query = q.trim().toLowerCase();
  const results = query
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(query) ||
        compName(p.company_id).toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)))
    : [];

  const run = (term: string) => { setQ(term); if (term.trim()) saveRecent(term.trim()); };

  return (
    <div className="pad">
      <div className="searchbar">
        <Icon name="search" />
        <input value={q} placeholder="글 제목·기업·태그 검색" autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && query) saveRecent(query); }} />
        {q && <button className="sb-clear" onClick={() => setQ("")} aria-label="지우기"><Icon name="x" /></button>}
      </div>

      {query ? (
        <>
          <div className="sec-title">검색 결과 {results.length}</div>
          {results.length ? results.map((p) => <PostCard key={p.id} post={p} />)
            : <div className="empty"><div className="art" /><div className="msg">결과가 없어요</div></div>}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className="sec-title">최근 검색어</div>
              {recent.map((t) => (
                <div key={t} className="recent-row">
                  <button className="recent-term" onClick={() => run(t)}><Icon name="search" size="sm" />{t}</button>
                  <button className="recent-x" onClick={() => removeRecent(t)} aria-label="삭제"><Icon name="x" size="sm" /></button>
                </div>
              ))}
            </>
          )}
          <div className="sec-title">급상승 검색어</div>
          {RISING.map((t, i) => (
            <button key={t} className="rank-row" onClick={() => run(t)}>
              <span className="rank-n">{i + 1}</span>{t}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
