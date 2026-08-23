import localFont from "next/font/local";

// Pretendard Variable을 CDN(@import)이 아니라 로컬 번들로 제공한다.
// CDN @import는 렌더링을 막고(render-blocking) 첫 페인트가 느려지는 원인이라,
// next/font/local로 바꿔 자체 호스팅 + font-display: swap + 레이아웃 시프트 방지를 얻는다.
export const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});
