"use client";

import { openOnboardingModal } from "./onboarding-bus";

/** 마이페이지 "나의 관심 관점" 의 설정하기/수정 — 레이아웃에 떠 있는 OnboardingModal 을 연다(페이지 이동 없음) */
export function OpenOnboardingButton({ label }: { label: string }) {
  return (
    <button onClick={openOnboardingModal} className="text-sm font-semibold text-ink-3 hover:text-ink">
      {label}
    </button>
  );
}
