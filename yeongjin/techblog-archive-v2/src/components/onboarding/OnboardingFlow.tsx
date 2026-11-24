"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { ROLE_INTERESTS, type Role } from "@/core/3-place/onboarding";
import type { ArticleRow } from "@/core/shared/types";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingLoginGate } from "./OnboardingLoginGate";
import { RoleStep } from "./RoleStep";
import { InterestStep } from "./InterestStep";
import { PerspectiveStep } from "./PerspectiveStep";
import { RecommendStep, type RecommendationWithLogo } from "./RecommendStep";

const STEP_NAMES = ["role", "interest", "perspective", "recommend"] as const;
const DRAFT_KEY = "tbp:onboarding-draft";

type Draft = { step: number; role: Role | null; interests: string[]; awaitingLogin?: boolean; startedAt?: number };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* 저장 불가 — 이번 화면에서만 진행, 새로고침하면 처음부터 */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

/** 로그인 사용자의 온보딩 설정을 저장한다 — 실패해도 홈 이동은 그대로 진행한다(스펙: 저장 오류가 서비스 이용을 막지 않음) */
function savePrefs(patch: { role?: string; interests?: string[]; onboardingStatus?: string }) {
  void fetch("/api/me/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

export function OnboardingFlow({
  next,
  isLoggedIn,
  initialRole,
  initialInterests,
  perspectiveArticle,
  perspectiveLogo,
}: {
  next: string;
  isLoggedIn: boolean;
  initialRole: Role | null;
  initialInterests: string[];
  perspectiveArticle: ArticleRow | null;
  perspectiveLogo: string | null;
}) {
  const router = useRouter();
  const [draft] = useState(() => readDraft());
  // 로그인하고 /onboarding 으로 막 돌아온 경우 — 임시 저장해 둔 대로 STEP 04 로 이어간다(초기 상태에서 바로 반영)
  const [resuming] = useState(() => isLoggedIn && !!draft?.awaitingLogin);

  const [step, setStep] = useState(resuming ? 4 : (draft?.step ?? 1));
  const [role, setRole] = useState<Role | null>(draft?.role ?? initialRole);
  const [interests, setInterests] = useState<string[]>(draft?.interests ?? initialInterests);
  const [viewRole, setViewRole] = useState<Role>(draft?.role ?? initialRole ?? "PLANNER");
  const [recs, setRecs] = useState<RecommendationWithLogo[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(resuming);
  // STEP 03→04 사이 로그인 요청 화면 — 로그인 전에는 STEP 04(맞춤 추천) 대신 이게 뜬다
  const [awaitingLogin, setAwaitingLogin] = useState(resuming ? false : (draft?.awaitingLogin ?? false));
  const startedAt = useRef<number | null>(draft?.startedAt ?? null);

  /** loadingRecs 는 부르는 쪽이 앞뒤로 관리한다 — 마운트 시 이어가기(resuming)는 초기 상태값으로 이미 true 라 */
  async function fetchRecs() {
    const result = await fetch("/api/onboarding/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: role ?? "PLANNER", interests }),
    })
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => data.recommendations as RecommendationWithLogo[])
      .catch(() => [] as RecommendationWithLogo[]);
    setRecs(result);
    setLoadingRecs(false);
  }

  useEffect(() => {
    if (!startedAt.current) {
      startedAt.current = Date.now();
      track("onboarding_start", { onboarding_version: 1 });
    }
    // 마운트 시 한 번만, 로그인 뒤 돌아왔을 때만 부른다 — 평범한 "조건부로 한 번 가져오기" 패턴이라 의도적으로 막는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resuming) void fetchRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    track("onboarding_step_view", { step_number: step, step_name: STEP_NAMES[step - 1] });
    writeDraft({ step, role, interests, awaitingLogin, startedAt: startedAt.current ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, awaitingLogin]);

  function goTo(n: number) {
    setStep(n);
  }

  function skip() {
    track("onboarding_skip", { step_number: step });
    savePrefs({ onboardingStatus: "skipped" });
    clearDraft();
    router.push(next);
  }

  function pickRole(r: Role) {
    setRole(r);
    setViewRole(r);
    track("onboarding_role_select", { role: r });
    savePrefs({ role: r, onboardingStatus: "in_progress" });
    window.setTimeout(() => goTo(2), 250); // 선택 피드백이 보인 뒤 짧게 쉬고 다음 단계로
  }

  function toggleInterest(id: string) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function confirmInterests() {
    track("onboarding_interest_select", { role: role ?? "", interest_ids: interests.join(","), interest_count: interests.length });
    savePrefs({ interests });
    goTo(3);
  }

  function switchPerspective(r: Role) {
    track("onboarding_perspective_switch", { from_role: viewRole, to_role: r, content_id: perspectiveArticle?.id ?? 0 });
    setViewRole(r);
  }

  async function goToRecommend() {
    if (!isLoggedIn) {
      setAwaitingLogin(true); // STEP 03 에 머문 채 로그인 요청 화면을 보여준다 — 로그인 뒤 /onboarding 으로 돌아오면 이어간다
      return;
    }
    goTo(4);
    setLoadingRecs(true);
    await fetchRecs();
  }

  function pickArticle(id: number) {
    track("personalized_content_click", { content_id: id, role: role ?? "", recommendation_source: "onboarding" });
    savePrefs({ role: role ?? undefined, interests, onboardingStatus: "completed" });
    clearDraft();
    // ArticleCard 의 Link 가 이어서 평소처럼 이동한다 — 저장은 막지 않고 같은 틱에 먼저 보낸다
  }

  function complete() {
    const elapsed = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    track("onboarding_complete", { role: role ?? "", interest_count: interests.length, elapsed_time: elapsed });
    savePrefs({ role: role ?? undefined, interests, onboardingStatus: "completed" });
    clearDraft();
    router.push(next);
  }

  const interestLabels = (role ? ROLE_INTERESTS[role] : []).filter((i) => interests.includes(i.id)).map((i) => i.label);

  return (
    <div className="mx-auto flex max-w-lg flex-col pb-10 pt-2">
      <div className="flex items-center gap-3">
        <OnboardingProgress step={step} />
        <button onClick={skip} className="shrink-0 text-sm font-semibold text-ink-3 hover:text-ink">
          건너뛰기
        </button>
      </div>

      <div key={awaitingLogin ? "login-gate" : step} className="ob-pop-in mt-8">
        {step === 1 && <RoleStep selected={role} onSelect={pickRole} />}
        {step === 2 && role && <InterestStep role={role} selected={interests} onToggle={toggleInterest} onNext={confirmInterests} />}
        {step === 3 && role && awaitingLogin && <OnboardingLoginGate role={role} interestLabels={interestLabels} />}
        {step === 3 && !awaitingLogin && (
          <PerspectiveStep
            article={perspectiveArticle}
            articleLogo={perspectiveLogo}
            viewRole={viewRole}
            onSwitch={switchPerspective}
            onNext={goToRecommend}
          />
        )}
        {step === 4 && role && (
          <RecommendStep
            role={role}
            interestLabels={interestLabels}
            recommendations={recs}
            loading={loadingRecs}
            onEditInterests={() => goTo(2)}
            onPickArticle={pickArticle}
            onStart={complete}
          />
        )}
      </div>
    </div>
  );
}
