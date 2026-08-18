// 기업 로고(파비콘) 도메인 해석 — 서비스 로고칩(ServiceLogo)에서 사용.
//
// 문제: 일부 테크블로그는 Medium(medium.com/...) 등에 호스팅돼 homepage 도메인이
//       브랜드와 다르다. 그대로 파비콘을 요청하면 Medium 아이콘이 떠서 브랜드 로고가 안 나온다.
// 해결: 블로그 key → '브랜드 실제 도메인' 매핑을 우선 적용한다.
//       - 네이버 계열은 전부 naver.com 으로 통일(일반 네이버 아이콘).
//       - 매핑에 없고 homepage 가 Medium 이면 브랜드 아이콘을 얻을 수 없으므로 null(이니셜 폴백).

const BRAND_DOMAIN: Record<string, string> = {
  // 네이버 계열 — 전부 일반 네이버 아이콘으로 통일
  naverpay: "naver.com",
  naver_d2: "naver.com",
  naver_place: "naver.com",
  naver_dna: "naver.com",
  // Medium 호스팅이라 homepage(medium.com)로는 브랜드 아이콘을 못 얻음 → 실제 브랜드 도메인 지정
  coupang: "coupang.com",
  // 서비스 대표 도메인이 회사 도메인과 달라 보정
  bucketplace: "ohou.se", // 오늘의집
  kakaopay: "kakaopay.com",
  kakao: "kakao.com",
  woowahan: "baemin.com", // 배달의민족
};

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * 파비콘을 요청할 도메인을 결정. 브랜드 매핑 우선 → homepage 도메인 → null(이니셜 폴백).
 * Medium 등 브랜드와 무관한 호스팅 도메인은 잘못된 아이콘을 막기 위해 null 로 떨군다.
 */
export function faviconDomain(
  blogKey?: string | null,
  homepage?: string | null,
): string | null {
  if (blogKey && BRAND_DOMAIN[blogKey]) return BRAND_DOMAIN[blogKey];
  const host = hostOf(homepage);
  if (!host) return null;
  if (/(^|\.)medium\.com$/i.test(host)) return null; // 브랜드 로고 아님 → 이니셜
  return host;
}

/** 구글 파비콘 서비스 URL(128px). */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}
