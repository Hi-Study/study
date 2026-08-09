"use client";

import { useState, useTransition } from "react";
import { submitReview } from "./actions";

const QS = [
  "인상 깊은 부분이 무엇이었나요",
  "업무에 어떻게 적용할 수 있나요",
  "인사이터들에게 하고 싶은 질문이 있다면",
];

export default function ReviewForm({ postId, initial }: { postId: string; initial: [string, string, string] }) {
  const [ans, setAns] = useState<[string, string, string]>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const canSubmit = ans.some((x) => x.trim());

  const set = (i: number, v: string) => setAns((a) => { const n = [...a] as typeof a; n[i] = v; return n; });
  const submit = () => {
    if (!canSubmit || pending) return;
    setErr("");
    start(async () => {
      const res = await submitReview(postId, ans[0], ans[1], ans[2]);
      if (res?.error) setErr(res.error);
    });
  };

  return (
    <div className="pad">
      <div className="hint" style={{ margin: "6px 0 16px" }}>3개 질문 중 최소 1개만 채워도 게시할 수 있어요</div>
      {QS.map((q, i) => (
        <div className="field" key={i}>
          <label>{q}</label>
          <textarea className="input" rows={3} value={ans[i]} onChange={(e) => set(i, e.target.value)} />
        </div>
      ))}
      {err && <div className="hint" style={{ color: "var(--orange)" }}>{err}</div>}
      <button className="btn btn-primary" disabled={!canSubmit || pending} onClick={submit}>
        {pending ? "게시 중…" : "게시하기"}
      </button>
      <div style={{ height: 24 }} />
    </div>
  );
}
