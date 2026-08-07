// 서비스 브랜드 마크 — 카드 썸네일이 없을 때의 대체 이미지 및 상단바 로고로 사용
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 21.5V10.5C9 9.67157 9.67157 9 10.5 9H17.5L23 14.5V21.5C23 22.3284 22.3284 23 21.5 23H10.5C9.67157 23 9 22.3284 9 21.5Z"
        fill="white"
        fillOpacity="0.92"
      />
      <path d="M17.5 9V13.5C17.5 14.0523 17.9477 14.5 18.5 14.5H23" className="stroke-primary" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="12" y="16.5" width="8" height="1.4" rx="0.7" fill="#C2C4C8" />
      <rect x="12" y="19.2" width="5.5" height="1.4" rx="0.7" fill="#C2C4C8" />
    </svg>
  );
}

// 썸네일이 없는 카드에서 쓰는 전체 배경형 플레이스홀더
export function BrandMarkPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-primary-subtle ${className}`}>
      <BrandMark className="h-12 w-12" />
    </div>
  );
}
