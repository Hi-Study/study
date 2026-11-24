"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { takeOnboardingMark } from "@/lib/analytics";
import { OnboardingFlow } from "./OnboardingFlow";
import { onOnboardingModalOpen } from "./onboarding-bus";
import type { Role } from "@/core/3-place/onboarding";

/**
 * 레이아웃에 한 번 떠 있는 온보딩 팝업 — 두 가지 경로로 열린다:
 *   1) 구글 로그인 직후, 아직 온보딩을 안 겪었으면(/auth/callback 이 남긴 쿠키) 자동으로
 *   2) 마이페이지 "설정하기/수정"을 누르면(onboarding-bus 윈도 이벤트)
 * 로그인하지 않은 사람에게는 애초에 이 컴포넌트를 그리지 않는다(layout.tsx 에서 user 유무로 가른다).
 */
export function OnboardingModal({ initialRole, initialInterests }: { initialRole: Role | null; initialInterests: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 마운트 시 쿠키(외부 신호)를 한 번만 읽어서 반영한다 — 평범한 "조건부로 한 번 읽기" 패턴이라 의도적으로 막는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (takeOnboardingMark()) setOpen(true);
    return onOnboardingModalOpen(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    router.refresh(); // 현재 화면의 서버 데이터(마이페이지 관심 관점, 홈 개인화 영역 등)를 새 설정으로 다시 가져온다
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-bg px-5 pt-5 sm:max-w-lg sm:rounded-3xl sm:px-6">
        <OnboardingFlow onClose={close} initialRole={initialRole} initialInterests={initialInterests} />
      </div>
    </div>
  );
}
