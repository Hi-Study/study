"use client";

import { useState } from "react";
import PostCard from "@/components/PostCard";
import { CATEGORIES, type Category, type Company, type Post } from "@/lib/types";

export default function FeedClient({ posts, companies }: { posts: Post[]; companies: Company[] }) {
  const [comps, setComps] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<Set<Category>>(new Set());

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    setter(n);
  };

  let list = posts;
  if (comps.size) list = list.filter((p) => p.company_id && comps.has(p.company_id));
  if (cats.size) list = list.filter((p) => cats.has(p.category));

  return (
    <>
      <div className="chips">
        {companies.map((c) => (
          <button key={c.id} className={`chip ${comps.has(c.id) ? "on" : ""}`} onClick={() => toggle(comps, c.id, setComps)}>{c.name}</button>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cats.has(c) ? "on" : ""}`} onClick={() => toggle(cats, c, setCats)}>{c}</button>
        ))}
      </div>
      <div style={{ height: 14 }} />
      {list.length ? (
        list.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <div className="empty"><div className="art" /><div className="msg">조건에 맞는 글이 없어요</div></div>
      )}
    </>
  );
}
