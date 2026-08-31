// 아티클 상세 로딩 스켈레톤
export default function Loading() {
  return (
    <div>
      <div className="appbar" />
      <div className="skel" style={{ height: 210, borderRadius: 0 }} />
      <div className="pad">
        <div className="skel" style={{ height: 26, width: "85%", margin: "18px 0 10px" }} />
        <div className="skel" style={{ height: 26, width: "55%", marginBottom: 16 }} />
        <div className="skel" style={{ height: 160, borderRadius: 14, marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="skel skel-line" key={i} style={{ margin: "10px 0", width: `${90 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}
