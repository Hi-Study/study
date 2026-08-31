"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

// 공유: Web Share API 있으면 시스템 공유, 없으면 링크 복사
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* 사용자 취소 등 무시 */
    }
  };
  return (
    <button className="iconbtn" onClick={share} aria-label="공유">
      <Icon name={copied ? "check" : "share"} />
    </button>
  );
}
