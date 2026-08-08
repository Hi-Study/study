import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <>
      <div className="screen">{children}</div>
      <TabBar />
    </>
  );
}
