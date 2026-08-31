// 기업 상세 로딩 스켈레톤
export default function Loading() {
  return (
    <div>
      <div className="appbar" />
      <div className="pad">
        <div className="skel" style={{ height: 34, width: "50%", margin: "8px 0 18px", borderRadius: 10 }} />
        <div className="skel" style={{ height: 20, width: 80, marginBottom: 12 }} />
        <div className="skel-row"><div className="skel skel-thumb" /><div className="skel-lines"><div className="skel skel-line" /><div className="skel skel-line short" /></div></div>
        <div className="skel-row"><div className="skel skel-thumb" /><div className="skel-lines"><div className="skel skel-line" /><div className="skel skel-line short" /></div></div>
      </div>
    </div>
  );
}
