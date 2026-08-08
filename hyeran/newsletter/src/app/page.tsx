import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return (
    <div className="onb-page">
      <div className="onb-top">
        <div className="onb-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20.5V6a2 2 0 0 1 2-2h11l3 3v13.5" />
            <path d="M8 9h8M8 13h8M8 17h5" />
          </svg>
        </div>
        <div className="onb-name">어노테이션</div>
        <div className="onb-headline">이 글의 첫 번째 리더가 되어보세요</div>
      </div>
      <OnboardingForm />
    </div>
  );
}
