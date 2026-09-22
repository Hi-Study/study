/**
 * 서비스 종류 — **어떤 종류의 서비스를 만드는 팀의 글인가**로 묶는다.
 *
 * 기업 이름으로만 모으면 "토스·카카오페이·네이버페이·뱅크샐러드"가 서로 멀리 떨어져 있다.
 * 기획자가 실제로 찾는 방식은 "우리랑 비슷한 서비스는 이 문제를 어떻게 풀었지?"라서,
 * **같은 종류끼리** 묶여 있어야 쓸모가 있다. 기업별 목록은 그대로 두고 한 축을 더한 것이다.
 *
 * ⚠️ DB 컬럼이 아니라 **여기 표가 정본**이다. `blogs.kind` 는 tech/design/product/culture 라
 *    "기술 블로그냐"를 말할 뿐, 무슨 서비스를 만드는지는 말하지 않는다.
 *    블로그를 새로 추가하면 이 표에도 한 줄 넣는다 — 빠지면 '그 밖의 서비스'로 떨어진다.
 */
export type ServiceKind = "commerce" | "finance" | "platform" | "local" | "cloud" | "etc";

export const SERVICE_KIND_ORDER: ServiceKind[] = [
  "commerce",
  "finance",
  "platform",
  "local",
  "cloud",
  "etc",
];

/**
 * 이름만 둔다. "사고파는 서비스" 같은 풀이는 붙이지 않는다 —
 * 커머스가 뭔지 모르는 사람은 없고, 한 줄이 붙는 순간 칩이 카드가 되어 자리를 뺏는다.
 */
export const SERVICE_KIND_META: Record<ServiceKind, { label: string }> = {
  commerce: { label: "커머스·쇼핑" },
  finance: { label: "금융·페이" },
  platform: { label: "포털·플랫폼" },
  local: { label: "지역·커뮤니티" },
  cloud: { label: "클라우드·인프라" },
  etc: { label: "그 밖의 서비스" },
};

/** blogs.key → 서비스 종류. 표에 없는 키는 etc. */
const KIND_BY_KEY: Record<string, ServiceKind> = {
  musinsa: "commerce",
  oliveyoung: "commerce",
  kurly: "commerce",
  coupang: "commerce",
  bucketplace: "commerce",
  woowahan: "commerce",
  // B컷은 배민의 디자인 블로그다 — 회사가 같으니 같은 칸에 둔다.
  bcut: "commerce",

  toss: "finance",
  kakaopay: "finance",
  naverpay: "finance",
  banksalad: "finance",

  kakao: "platform",
  naver_d2: "platform",
  naver_dna: "platform",

  daangn: "local",
  naver_place: "local",
  gangnamunni: "local",

  aws: "cloud",
  nds: "cloud",
};

export function serviceKindOf(blogKey: string | null | undefined): ServiceKind {
  if (!blogKey) return "etc";
  return KIND_BY_KEY[blogKey] ?? "etc";
}

/**
 * 화면에 띄울 종류만 — **글이 실제로 있는 종류**만 남긴다.
 * 빈 칸을 눌러 "0개"를 보게 하지 않는다(숫자로 벌주지 않는다는 규칙과 같은 이유).
 */
export function serviceKindsPresent(blogKeys: string[]): ServiceKind[] {
  const present = new Set(blogKeys.map(serviceKindOf));
  return SERVICE_KIND_ORDER.filter((k) => present.has(k));
}
