/**
 * 레이아웃에 떠 있는 OnboardingModal 을 다른 화면(마이페이지 "설정하기" 등)에서 열 때 쓰는 신호.
 * ReadState.tsx 의 MODE_EVENT/HIDE_EVENT 와 같은 패턴(윈도 이벤트) — 별도 상태 관리 라이브러리 없이 연결한다.
 */
const OPEN_EVENT = "onboarding-modal-open";

export function openOnboardingModal() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOnboardingModalOpen(cb: () => void): () => void {
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}
