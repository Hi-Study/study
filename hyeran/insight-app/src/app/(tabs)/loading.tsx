export default function Loading() {
  return (
    <div>
      <div className="appbar"><div className="skel skel-line" style={{ width: 120, height: 22 }} /></div>
      <div className="pad">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel skel-card" />
        ))}
      </div>
    </div>
  );
}
