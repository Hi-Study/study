"use client";

import { useState, type ReactNode } from "react";

// 아티클 상세 원문/인사이트 탭 (둘 다 마운트 유지 → 스크롤·상태 보존, 표시만 토글)
export default function DetailTabs({
  original, insights, insightCount, defaultTab = "original",
}: {
  original: ReactNode;
  insights: ReactNode;
  insightCount: number;
  defaultTab?: "original" | "insight";
}) {
  const [tab, setTab] = useState<"original" | "insight">(defaultTab);
  return (
    <>
      <div className="utabs dtabs">
        <button className={`utab ${tab === "original" ? "on" : ""}`} onClick={() => setTab("original")}>원문</button>
        <button className={`utab ${tab === "insight" ? "on" : ""}`} onClick={() => setTab("insight")}>
          인사이트{insightCount > 0 ? ` ${insightCount}` : ""}
        </button>
      </div>
      <div style={{ display: tab === "original" ? "block" : "none" }}>{original}</div>
      <div style={{ display: tab === "insight" ? "block" : "none" }}>{insights}</div>
    </>
  );
}
