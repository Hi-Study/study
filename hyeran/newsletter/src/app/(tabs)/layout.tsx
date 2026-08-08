import TabBar from "@/components/TabBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      {children}
      <TabBar />
    </div>
  );
}
