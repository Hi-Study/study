"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerPost, checkDuplicate } from "./actions";

const QS = [
  "인상 깊은 부분이 무엇이었나요",
  "업무에 어떻게 적용할 수 있나요",
  "인사이터들에게 하고 싶은 질문이 있다면",
];

export default function RegisterForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [ans, setAns] = useState<[string, string, string]>(["", "", ""]);
  const [dup, setDup] = useState<{ postId: string } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const canSubmit = url.trim() && ans.some((x) => x.trim());
  const set = (i: number, v: string) => setAns((a) => { const n = [...a] as typeof a; n[i] = v; return n; });

  const onUrlBlur = async () => {
    setDup(null);
    if (!url.trim()) return;
    const res = await checkDuplicate(url);
    if (res.exists && res.postId) setDup({ postId: res.postId });
  };

  const submit = () => {
    if (!canSubmit || pending) return;
    setErr(""); setDup(null);
    start(async () => {
      const res = await registerPost(url, ans[0], ans[1], ans[2]);
      if (res?.duplicate && res.postId) { setDup({ postId: res.postId }); return; }
      if (res?.error) { setErr(res.error); return; }
      if (res?.ok && res.postId) { router.push(`/posts/${res.postId}`); router.refresh(); }
    });
  };

  return (
    <div className="pad">
      <div className="field">
        <label>URL</label>
        <input className="input" placeholder="공유할 기사·블로그 링크 붙여넣기" value={url}
          onChange={(e) => setUrl(e.target.value)} onBlur={onUrlBlur} />
        {dup ? (
          <div className="hint">이미 등록된 글이에요{" "}
            <a onClick={() => router.push(`/posts/${dup.postId}`)} style={{ color: "var(--blue)", cursor: "pointer" }}>등록 글 보기</a>
          </div>
        ) : (
          <div className="hint">등록하면 제목·기업·태그·AI 요약은 자동으로 채워져요</div>
        )}
      </div>

      <div className="field">
        <label>독후감 · 최소 1개 필수</label>
        {QS.map((q, i) => (
          <textarea key={i} className="input" rows={3} placeholder={q} value={ans[i]}
            onChange={(e) => set(i, e.target.value)} style={{ marginBottom: 8 }} />
        ))}
      </div>

      {err && <div className="hint" style={{ color: "var(--orange)" }}>{err}</div>}
      <button className="btn btn-primary" disabled={!canSubmit || pending} onClick={submit}>
        {pending ? "등록 중… (원문 분석·AI 요약)" : "등록하기"}
      </button>
      <div style={{ height: 24 }} />
    </div>
  );
}
