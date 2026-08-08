import BackButton from "@/components/BackButton";

export default function SearchPage() {
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title">검색</span></div>
      <div className="empty"><div className="art" /><div className="msg">검색은 곧 지원해요</div></div>
    </div>
  );
}
