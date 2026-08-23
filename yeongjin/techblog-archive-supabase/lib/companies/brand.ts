// 기업 로고/브랜드 컬러 레지스트리 — 홈 화면의 기업 칩·썸네일 폴백에 사용한다.
// 로고는 각 서비스가 자체 CDN을 안정적으로 공개하지 않아, 파비콘을 안정적으로 반환하는
// 구글 파비콘 서비스로 대신한다. 브랜드 컬러는 근사치(팀 톤에 맞게 추후 보정 가능, DESIGN.md 톤과 동일한 방식).
export type CompanyBrand = { logoUrl: string; color: string };

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

const KNOWN_BRANDS: Record<string, CompanyBrand> = {
  "토스 기술 블로그": { logoUrl: faviconUrl("toss.tech"), color: "#0064FF" },
  "우아한형제들 기술블로그": { logoUrl: faviconUrl("baemin.com"), color: "#29CC97" },
  "당근 기술 블로그": { logoUrl: faviconUrl("daangn.com"), color: "#FF8A3D" },
};

// 등록되지 않은(수동 등록) 기업은 이름 해시로 고정 색상을 배정해 최소한 일관되게 보이게 한다.
const FALLBACK_COLORS = ["#0064FF", "#FF8A3D", "#29CC97", "#7C5CFC", "#FF5C7A", "#12B3B3"];

export function getCompanyBrand(company: string): CompanyBrand {
  const known = KNOWN_BRANDS[company];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = (hash * 31 + company.charCodeAt(i)) % 997;
  const color = FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
  return { logoUrl: "", color };
}
