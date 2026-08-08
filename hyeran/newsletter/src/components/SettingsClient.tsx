"use client";

import { useEffect, useState } from "react";
import { signOut } from "@/app/actions";

export default function SettingsClient() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [notifNewPost, setNotifNewPost] = useState(true);
  const [notifComment, setNotifComment] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme") as "system" | "light" | "dark" | null;
    if (saved) applyTheme(saved);
  }, []);

  function applyTheme(next: "system" | "light" | "dark") {
    setTheme(next);
    window.localStorage.setItem("theme", next);
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <>
      <div className="filter-label">화면 모드</div>
      <div className="segment" style={{ margin: "2px 16px 20px" }}>
        <button className={theme === "system" ? "active" : ""} onClick={() => applyTheme("system")}>
          시스템
        </button>
        <button className={theme === "light" ? "active" : ""} onClick={() => applyTheme("light")}>
          라이트
        </button>
        <button className={theme === "dark" ? "active" : ""} onClick={() => applyTheme("dark")}>
          다크
        </button>
      </div>
      <div className="filter-label">알림</div>
      <div className="settings-row">
        <span>새 글 알림</span>
        <button
          className={`switch${notifNewPost ? " on" : ""}`}
          onClick={() => setNotifNewPost((v) => !v)}
        />
      </div>
      <div className="settings-row">
        <span>코멘트 알림</span>
        <button
          className={`switch${notifComment ? " on" : ""}`}
          onClick={() => setNotifComment((v) => !v)}
        />
      </div>
      <div style={{ height: 28 }} />
      <form action={signOut}>
        <button className="btn-logout" type="submit">
          로그아웃
        </button>
      </form>
    </>
  );
}
