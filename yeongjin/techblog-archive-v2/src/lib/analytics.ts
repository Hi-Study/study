/**
 * GA4 이벤트 보내기 — 서비스의 모든 GA 이벤트는 이 파일의 track() 으로만 보낸다.
 * 이벤트 이름·값 목록과 규칙은 구글 시트 「인사이트 GA 측정 설계」의 이벤트 사전 탭을 따른다.
 *
 * GA 스크립트(gtag.js)는 layout.tsx 에서 불러온다. 그 스크립트가 window.gtag 를 만들기 전에 보낸 것은
 * 잠깐 모아 두었다가 준비되면 순서대로 보낸다(화면을 열자마자 보내는 login · user id 가 빠지지 않게).
 * 광고 차단기로 GA 가 막혀도 에러 없이 조용히 넘어간다.
 */

export type TrackParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const waiting: unknown[][] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  if (window.gtag) {
    window.gtag(...args);
    return;
  }
  waiting.push(args);
  if (timer) return;
  let tries = 0;
  timer = setInterval(() => {
    tries += 1;
    if (window.gtag) waiting.splice(0).forEach((a) => window.gtag?.(...a));
    if (window.gtag || tries >= 50) {
      if (timer) clearInterval(timer);
      timer = null;
    }
  }, 200);
}

/** 이벤트 하나 보내기 — 예: track("tab_click", { tab_name: "feed" }) */
export function track(name: string, params: TrackParams = {}) {
  gtag("event", name, params);
}

/**
 * 로그인한 사람의 Supabase user id 를 GA 에 알린다 — 재방문을 기기가 아니라 계정 기준으로 세려고.
 * 이메일·이름 같은 개인정보는 절대 넣지 않는다. 로그아웃은 화면을 새로 열어서 저절로 빠진다.
 */
export function setUserId(userId: string) {
  gtag("set", { user_id: userId });
}

/** 구글 로그인을 막 마쳤다는 표시 — /auth/callback 이 남기고, 화면(AccountSync)이 읽어서 login 이벤트를 한 번 보낸 뒤 지운다 */
export const LOGIN_MARK_COOKIE = "ga-login";

export function takeLoginMark(): boolean {
  if (typeof document === "undefined") return false;
  const on = document.cookie.split("; ").includes(`${LOGIN_MARK_COOKIE}=1`);
  if (on) document.cookie = `${LOGIN_MARK_COOKIE}=; Max-Age=0; path=/`;
  return on;
}

/**
 * 홈 섹션에서 링크를 누를 때 어느 섹션이었는지 이 탭에 잠깐 적어 둔다 — 글 상세의 article_view 가 entry_source 를 정할 때 읽고 지운다.
 * (로그인 화면을 거쳐도 같은 탭이면 남아 있다)
 */
const HOME_SECTION_KEY = "ga:home-section";

export function markHomeSection(name: string) {
  try {
    sessionStorage.setItem(HOME_SECTION_KEY, name);
  } catch {}
}

function takeHomeSection(): string | null {
  try {
    const v = sessionStorage.getItem(HOME_SECTION_KEY);
    sessionStorage.removeItem(HOME_SECTION_KEY);
    return v;
  } catch {
    return null;
  }
}

/**
 * 글 상세에 어디서 들어왔나(article_view 의 entry_source) — 바로 앞 화면 주소(BackNav 발자취)로 정한다.
 * 값 목록은 구글 시트 이벤트 사전과 같다. 앞 화면이 없으면(링크를 받아 바로 들어옴) external.
 */
export function entrySourceOf(prevUrl: string | null): string {
  const section = takeHomeSection();
  if (!prevUrl) return "external";
  const path = prevUrl.split("?")[0];
  if (path === "/") return section ? `home_${section}` : "home";
  if (path.startsWith("/feed")) return "feed";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/my")) return "my";
  if (path.startsWith("/experiences/")) return "experience_page";
  if (path.startsWith("/tech/")) return "tech_page";
  if (path.startsWith("/articles/")) return "article";
  return "other";
}
