import { ImageResponse } from "next/og";

/** 아이폰 홈 화면 아이콘 — icon.svg 와 같은 그림(검은 바탕 · 흰 I · 키컬러 점). 모서리는 기기가 둥글게 깎는다 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#191f28", position: "relative", display: "flex" }}>
        <div style={{ position: "absolute", left: 56, top: 39, width: 31, height: 101, borderRadius: 4, background: "#ffffff" }} />
        <div style={{ position: "absolute", left: 103, top: 105, width: 36, height: 36, borderRadius: 18, background: "#ff4a28" }} />
      </div>
    ),
    size,
  );
}
