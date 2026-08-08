import BackButton from "@/components/BackButton";

export default function WriteReviewPage() {
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title" style={{ fontSize: 17 }}>독후감 쓰기</span></div>
      <div className="empty"><div className="art" /><div className="msg">독후감 작성은 곧 지원해요</div></div>
    </div>
  );
}
