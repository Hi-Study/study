"use client";

import type { AnchorHTMLAttributes } from "react";
import { track, type TrackParams } from "@/lib/analytics";

/** 누르면 GA 이벤트를 보내는 일반 링크(a) — 서버에서 그리는 화면 안의 링크에 클릭 추적을 붙일 때 쓴다 */
export function TrackedAnchor({
  event,
  params,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { event: string; params?: TrackParams }) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track(event, params);
        onClick?.(e);
      }}
    />
  );
}
