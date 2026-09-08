// 기업 로고 — 도메인/이름으로 매칭, 없으면 이니셜 폴백
type Mark = React.ReactNode;
const LOGOS: { test: RegExp; svg: Mark }[] = [
  { test: /toss/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#3182F6" /><text x="20" y="26" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="13.5" fontWeight="700" fill="#fff">toss</text></svg>
  ) },
  { test: /kakao/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#FEE500" /><ellipse cx="20" cy="18.5" rx="11.5" ry="9" fill="#3B1E1E" /><path d="M12.5 24.5c.6 2.2.2 3.9-.4 5 2.2-.6 3.8-1.6 4.7-2.4z" fill="#3B1E1E" /><ellipse cx="20" cy="18.5" rx="8" ry="6" fill="#FEE500" /></svg>
  ) },
  { test: /naver|d2\./i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#03C75A" /><path d="M14 12h5.3l5.4 8V12H30v16h-5.3L19.3 20v8H14z" fill="#fff" /></svg>
  ) },
  { test: /woowa|baemin|배민|우아한/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#2AC1BC" /><text x="20" y="26" textAnchor="middle" fontFamily="Pretendard, system-ui, sans-serif" fontSize="14" fontWeight="800" fill="#fff">배민</text></svg>
  ) },
  { test: /daangn|karrot|당근/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#FF7E36" /><path d="M18.5 30.5c-3.2-1.6-6.2-6.8-4.6-10 1-2 5.2-2.2 8.2-.6 2.8 1.6 1.8 5.8-.4 8.6-1.2 1.5-2.4 2.2-3.2 2z" fill="#fff" /><path d="M22 16.5c.4-2.6 2.2-4.4 4.8-4.8-.2 2.8-1.8 4.6-4.8 4.8z" fill="#fff" /><path d="M20 17c-.8-2.2-2.6-3.6-5-3.8.4 2.4 2 4 5 3.8z" fill="#fff" opacity=".85" /></svg>
  ) },
  { test: /line/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#06C755" /><text x="20" y="25" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="800" fill="#fff">LINE</text></svg>
  ) },
];

export function CompanyLogo({ company }: { company?: { name: string; color: string; domain?: string | null } | null }) {
  if (!company) return null;
  const key = `${company.domain ?? ""} ${company.name}`;
  const svg = LOGOS.find((l) => l.test.test(key))?.svg ?? null;
  return (
    <span className="clogo" style={svg ? undefined : { background: company.color }}>
      {svg ?? company.name[0]}
    </span>
  );
}
export default CompanyLogo;
