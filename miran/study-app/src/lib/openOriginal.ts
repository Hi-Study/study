/**
 * "원문 보러가기"를 어디로 보낼지 정하는 **한 곳**.
 *
 * 웹에는 웹뷰가 없다. 남의 페이지를 내 화면에 넣는 수단은 iframe 하나뿐이고,
 * `X-Frame-Options` 는 **서버가 브라우저에게 내리는 명령**이라 클라이언트가 못 피한다.
 * 실측(2026-09-21, 블로그 19곳): 7곳이 막는다 — 네이버 D2(DENY)·DNA·플레이스·페이,
 * 쿠팡, 무신사, AWS. 나머지 12곳은 열린다.
 *
 * 문제는 "막혔다"를 **클라이언트가 감지할 수 없다**는 것이다. 크로스오리진이라 안을 못 보고,
 * onError 도 안 온다. 그래서 예전엔 눌러야 빈 화면을 만나고, 안내조차 없었다.
 *
 * 해결은 간단하다 — **미리 알아 두고 누르기 전에 올바른 문을 보여준다.**
 *   · 앱(네이티브): 웹뷰가 있으니 늘 앱 안에서 연다.
 *   · 웹 + 프레임 허용(`frameable === true`): 앱 안 iframe.
 *   · 웹 + 그 외(차단·아직 모름): **새 탭.** 웹에서는 브라우저가 곧 앱이라 이게 정상 동작이다.
 *
 * 아직 모르는 블로그(`null`)를 새 탭으로 보내는 건 의도적이다. 모르는 채로 iframe 을 걸면
 * 빈 화면이 나올 수 있는데, 그건 "안 열린다"보다 나쁘다(무엇이 잘못됐는지 알 수 없다).
 */
import { Platform, Linking } from "react-native";

import type { RootNav } from "@/navigation/types";

export function openOriginal(
  nav: RootNav,
  article: { url: string; blog?: { name?: string | null; frameable?: boolean | null } | null },
) {
  const inApp = Platform.OS !== "web" || article.blog?.frameable === true;
  if (inApp) {
    nav.navigate("ArticleWebView", { url: article.url, title: article.blog?.name ?? undefined });
    return;
  }
  // 새 탭 — 원래 탭은 그대로 남아서 읽던 자리로 돌아올 수 있다.
  Linking.openURL(article.url).catch(() => undefined);
}

/** 이 글의 원문이 **새 탭에서** 열리는가 — 버튼 글자를 그에 맞게 쓰려고. */
export function opensInNewTab(article: {
  blog?: { frameable?: boolean | null } | null;
}): boolean {
  return Platform.OS === "web" && article.blog?.frameable !== true;
}
