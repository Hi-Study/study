"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "./actions";

const QS = [
  "인상 깊은 부분이 무엇이었나요",
  "업무에 어떻게 적용할 수 있나요",
  "인사이터들에게 하고 싶은 질문이 있다면",
];

export default function ReviewSheet({ postId, initial }: { postId: string; initial: [string, string, string] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<[string, string, string]>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const canSubmit = ans.some((x) => x.trim());
  const hasReview = initial.some((x) => x.trim());

  const set = (i: number, v: string) => setAns((a) => { const n = [...a] as typeof a; n[i] = v; return n; });
  const close = () => { if (!pending) setOpen(false); };
  const submit = () => {
    if (!canSubmit || pending) return;
    setErr("");
    start(async () => {
      const res = await submitReview(postId, ans[0], ans[1], ans[2]);
      if (res?.error) { setErr(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button className="btn btn-outline" style={{ marginBottom: 10 }} onClick={() => setOpen(true)}>
        {hasReview ? "인사이트 수정" : "인사이트 쓰기"}
      </button>

      {open && <div className={`scrim show`} onClick={close} />}
      <div className={`drawer ${open ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">
          인사이트 쓰기
          <button className="submit" disabled={!canSubmit || pending} onClick={submit}>
            {pending ? "게시 중…" : "게시"}
          </button>
        </div>
        <div className="dbody">
          <div className="hint" style={{ margin: "0 0 14px" }}>3개 질문 중 최소 1개만 채워도 게시할 수 있어요 · 위 본문을 참고하세요</div>
          {QS.map((q, i) => (
            <div className="field" key={i}>
              <label>{q}</label>
              <textarea className="input" rows={3} value={ans[i]} onChange={(e) => set(i, e.target.value)} />
            </div>
          ))}
          {err && <div className="hint" style={{ color: "var(--danger)" }}>{err}</div>}
        </div>
      </div>
    </>
  );
}
