// 탭 전환 시 즉시 표시되는 스켈레톤 (체감 속도)
export default function Loading() {
  return (
    <>
      <div className="appbar"><span className="title" style={{ opacity: 0.35 }}>불러오는 중…</span></div>
      <div className="pad">
        <div className="skel" style={{ height: 44, margin: "12px 0", borderRadius: 999 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skel-row" key={i}>
            <div className="skel skel-thumb" />
            <div className="skel-lines">
              <div className="skel skel-line" />
              <div className="skel skel-line short" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
