// 전역 로딩 UI — 라우트 전환·클라이언트 액션의 즉시 피드백용

export function Spinner({ size = 22 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="로딩 중" />;
}

// 리스트형 페이지 스켈레톤 (앱바 + 카드들) — 각 라우트 loading.tsx 폴백용
export function PageSkeleton({ cards = 6, title = true }: { cards?: number; title?: boolean }) {
  return (
    <div>
      <div className="appbar">
        {title
          ? <div className="skel skel-line" style={{ width: 120, height: 22 }} />
          : <div style={{ flex: 1 }} />}
      </div>
      <div className="pad">
        {Array.from({ length: cards }).map((_, i) => <div key={i} className="skel skel-card" />)}
      </div>
    </div>
  );
}

// 기본 = 화면 중앙 스피너
export default function Loading() {
  return <div className="loading-screen"><Spinner size={28} /></div>;
}
