import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { BottomTabBar } from "@/components/BottomTabBar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar userId={session.user.id} userName={session.user.name ?? "팀원"} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-4">{children}</main>
      <BottomTabBar />
    </div>
  );
}
