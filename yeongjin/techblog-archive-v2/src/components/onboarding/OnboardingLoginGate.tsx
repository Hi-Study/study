import { GoogleMark } from "@/components/common/GoogleMark";
import { TrackedAnchor } from "@/components/common/TrackedAnchor";
import { ROLE_META, type Role } from "@/core/3-place/onboarding";

/**
 * STEP 03(관점 체험)까지 로그인 없이 보여준 뒤, STEP 04(맞춤 추천)로 넘어가기 전에 띄운다 —
 * "로그인하면 이런 걸 얻을 수 있다"는 경험을 먼저 주고 나서 로그인을 요청한다(2026-11-25 논의).
 * 로그인 뒤에는 /onboarding 으로 그대로 돌아오고, OnboardingFlow 가 세션 임시 저장(draft)을 보고 이어서 진행한다.
 */
export function OnboardingLoginGate({ role, interestLabels }: { role: Role; interestLabels: string[] }) {
  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">로그인하면 맞춤 추천을 받을 수 있어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">
        <b className="text-ink">{ROLE_META[role].label}</b> 관점으로 고른 사례를 계정에 저장해서
        <br />
        다음에 와도 이어서 볼 수 있어요.
      </p>
      {interestLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {interestLabels.map((label) => (
            <span key={label} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              #{label}
            </span>
          ))}
        </div>
      )}
      <TrackedAnchor
        event="login_start"
        params={{ method: "google", source: "onboarding" }}
        href="/auth/google?next=%2Fonboarding"
        className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface py-4 font-bold text-ink transition duration-200 hover:border-ink-3 active:scale-[0.98]"
      >
        <GoogleMark />
        Google로 계속하기
      </TrackedAnchor>
    </div>
  );
}
