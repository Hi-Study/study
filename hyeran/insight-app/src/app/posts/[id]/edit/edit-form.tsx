"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/types";
import { updatePost } from "../actions";

type Init = { title: string; category: Category; tags: string[]; problem: string; solution: string; learning: string };

export default function EditForm({ postId, init }: { postId: string; init: Init }) {
  const router = useRouter();
  const [title, setTitle] = useState(init.title);
  const [category, setCategory] = useState<Category>(init.category);
  const [tags, setTags] = useState(init.tags.join(", "));
  const [problem, setProblem] = useState(init.problem);
  const [solution, setSolution] = useState(init.solution);
  const [learning, setLearning] = useState(init.learning);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    if (!title.trim() || pending) return;
    setErr("");
    start(async () => {
      const res = await updatePost(postId, { title, category, tags, problem, solution, learning });
      if (res?.error) { setErr(res.error); return; }
      router.replace(`/posts/${postId}`);
      router.refresh();
    });
  };

  return (
    <div className="pad">
      <div className="field">
        <label>제목</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>카테고리</label>
        <div className="chips" style={{ flexWrap: "wrap", overflowX: "visible" }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>태그 · 쉼표로 구분</label>
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예: 온보딩, 리텐션" />
      </div>
      <div className="field">
        <label>AI 요약 · 무슨 문제를 다뤘나</label>
        <textarea className="input" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
      </div>
      <div className="field">
        <label>어떻게 해결했나</label>
        <textarea className="input" rows={2} value={solution} onChange={(e) => setSolution(e.target.value)} />
      </div>
      <div className="field">
        <label>기획 관점에서 무엇을 배울 수 있나</label>
        <textarea className="input" rows={2} value={learning} onChange={(e) => setLearning(e.target.value)} />
      </div>
      {err && <div className="hint" style={{ color: "var(--danger)" }}>{err}</div>}
      <button className="btn btn-primary" disabled={!title.trim() || pending} onClick={submit}>
        {pending ? "저장 중…" : "저장하기"}
      </button>
      <div style={{ height: 24 }} />
    </div>
  );
}
