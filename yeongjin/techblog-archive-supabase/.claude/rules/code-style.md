# 코드 스타일

- TypeScript strict, `any` 지양
- 컴포넌트: shadcn/ui 패턴 따라 `components/ui`에 있는 것 우선 재사용
- 서버 로직은 Server Component/Route Handler에서, 클라이언트 상태는 최소화
- Zod로 외부 입력(폼, API 응답) 검증 후 사용
- Tailwind 클래스는 `tailwind-merge`/`clsx`(`cn` 유틸)로 조합
