"use client";

import { useState, useTransition } from "react";
import { requestMagicLink } from "./actions";

export default function OnboardingForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestMagicLink(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="onb-form">
        <p className="onb-headline" style={{ fontSize: 15 }}>
          이메일로 로그인 링크를 보냈어요.
        </p>
        <p className="onb-link">메일함을 확인하고 링크를 눌러주세요.</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="onb-form">
      <label htmlFor="inviteCode">초대 코드</label>
      <input
        id="inviteCode"
        name="inviteCode"
        className="onb-input"
        type="text"
        placeholder="예: PLANNER2026"
        required
      />
      <label htmlFor="email">이메일</label>
      <input
        id="email"
        name="email"
        className="onb-input"
        type="email"
        placeholder="you@example.com"
        required
      />
      {error && <p className="onb-error">{error}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "확인 중..." : "계속"}
      </button>
      <div className="onb-link">초대 코드가 없나요?</div>
    </form>
  );
}
