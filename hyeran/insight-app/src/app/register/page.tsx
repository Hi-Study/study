import BackButton from "@/components/BackButton";

export default function RegisterPage() {
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title" style={{ fontSize: 17 }}>글 등록</span></div>
      <div className="empty"><div className="art" /><div className="msg">글 등록은 곧 지원해요</div></div>
    </div>
  );
}
