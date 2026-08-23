import { BottomNav } from "@/components/bottom-nav";
import { WriteFab } from "@/components/write-fab";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// proxy.ts 도 로그인 여부를 확인하지만, middleware 우회 가능성(CVE-2025-29927 등)에
// 대비해 실제 데이터를 다루는 레이아웃에서 서버 쪽에서 다시 한 번 확인한다.
// AUTH_REQUIRED=false 인 동안은 로그인 없이 화면만 미리 볼 수 있게 건너뛴다 —
// 배포 전 반드시 true로 되돌려야 한다 (PRD: 팀원 로그인 필수).
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AUTH_REQUIRED=false 일 때는 Supabase 호출 자체를 건너뛴다 — 지금처럼 Supabase
  // 프로젝트가 죽어 있어도(DNS 실패) 화면 테스트가 막히지 않게 하기 위해서다.
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }
  }

  return (
    <div className="min-h-dvh w-full bg-background pb-20">
      <main className="mx-auto w-full max-w-xl">{children}</main>
      <WriteFab />
      <BottomNav />
    </div>
  );
}
