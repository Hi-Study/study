# 디자인 시스템

자세한 배경·토큰표·화면별 매핑은 [DESIGN.md](../../DESIGN.md) 참고 (사락 앱 캡처 기반 v0.1).

- 행동 요소(버튼/필터칩/상태 드롭다운/배지)는 `rounded-full`, 콘텐츠 요소(카드/썸네일/AI 요약 박스)는 `rounded-xl`~`rounded-2xl` — 섞어 쓰지 않는다
- 리스트 아이템(피드 행, 검색 결과 행)은 카드가 아니라 `border-b` 구분선 목록으로 만든다
- 색상은 `tailwind.config.ts`의 토큰(`primary`/`featured`/`highlight` 등)만 사용, 임의 hex 하드코딩 금지
- 새 UI는 먼저 `components/ui`에 재사용 가능한 variant가 있는지 확인하고, 없으면 DESIGN.md 5장 체크리스트에 등록 후 추가
- 빈 상태(로그인 필요 등)는 안내문 1~2줄 + 단일 CTA(`variant: "cta"`, 검정 알약) 패턴을 통일해서 쓴다
