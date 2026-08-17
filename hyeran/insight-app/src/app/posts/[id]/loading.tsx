export default function Loading() {
  return (
    <div>
      <div className="appbar"><div style={{ flex: 1 }} /></div>
      <div className="pad">
        <div className="skel skel-line" style={{ width: "80%", height: 24, margin: "14px 0 10px" }} />
        <div className="skel skel-line" style={{ width: 140, height: 16 }} />
        <div className="skel" style={{ height: 150, borderRadius: 12, margin: "18px 0" }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel skel-line" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
