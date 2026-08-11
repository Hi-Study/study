"use client";

import { useState } from "react";

type Noti = { id: string; type: string; title: string; body: string; read: boolean; created_at: string };
const SEGS = [
  { key: "all", label: "전체" },
  { key: "new_post", label: "새 글" },
  { key: "comment", label: "인사이트 댓글" },
];

export default function NotificationsClient({ items }: { items: Noti[] }) {
  const [seg, setSeg] = useState("all");
  const list = seg === "all" ? items : items.filter((n) => n.type === seg);

  const rel = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "방금";
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  };

  return (
    <div className="pad">
      <div className="seg">
        {SEGS.map((s) => (
          <button key={s.key} className={seg === s.key ? "on" : ""} onClick={() => setSeg(s.key)}>{s.label}</button>
        ))}
      </div>
      {list.length ? (
        list.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10, padding: "13px 2px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.read ? "transparent" : "var(--blue)", marginTop: 6, flex: "0 0 auto" }} />
            <div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 2 }}>{n.body}</div>}
              <div className="mono" style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 4 }}>{rel(n.created_at)}</div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty"><div className="art" /><div className="msg">알림이 없어요</div></div>
      )}
    </div>
  );
}
