# 테크아카이브 (TechArchive)

기술 블로그 아카이빙 서비스. URL로 글을 등록하면 카테고리/태그/회사로 분류하고,
AI 요약 및 하이라이트 기반 협업 학습을 지원한다.

## 스택
- Next.js (App Router) + TypeScript
- Supabase (Auth, DB) — `@supabase/ssr`
- Tailwind CSS + shadcn/ui
- AI: Gemini(`@google/generative-ai`, 요약), Groq(`groq-sdk`, 쉬운 설명)
- 검증: Zod

## 스크립트
- `npm run dev` / `npm run build` / `npm run start` / `npm run lint`

## 기능 범위 (MVP + v1.1, 2026-08-06 회의 반영 — v0.2)
- 하단탭(홈/피드/토론/검색/마이), 구글 로그인
- URL 등록 + 독후감 필수(인상 깊은 부분/접목하고 싶은 방법/질문·토론 주제)
- 회사·태그 분류, 중복 URL 방지, 삭제(작성자 본인+관리자)
- 글 상세: 의견+쓰레드 댓글(대댓글 1단계)+멘션+이모지 리액션
- 토론: 독후감 기준 노출(인기/최신/추천 탭 + 카테고리) + 댓글 + 가벼운 참여 토글(참여 인원 표시, 모집/개설/종료 절차는 없음)
- 북마크(글 단위)+부분 북마크(하이라이트)
- 하이라이트+개인 메모(나만 보기 — 팀 공개 옵션 없음)
- 마이페이지(임시저장/내 글(독후감 기준)/내 댓글/북마크/하이라이트·메모/읽은 아티클)
- AI 요약(Gemini, 문제/해결/디자이너·PM 관점 3항목), AI 쉬운 설명(Groq)
- 검색(최근/추천(질문형)/급상승 검색어), 컬렉션, 검색 고도화(태그/회사/작성자 복합 필터)
- 자동 수집(크롤링): 꾸준히 올리는 기업 대상, 2025-07-01 이후 글만
- 알림(좋아요한 기업의 새 글/내 독후감의 댓글/대댓글)

## 오픈 이슈 → feature flag 기본값
자세한 배경은 [테크블로그_아카이빙_서비스_PRD_1.md](../테크블로그_아카이빙_서비스_PRD_1.md) 10장, [SCOPE.md](SCOPE.md) 참고.

| 이슈 | 기본값 | 환경변수 |
|---|---|---|
| 원문 본문 스냅샷 저장 | 저장함, 서비스 내 렌더링(확정) | `FEATURE_ORIGINAL_SNAPSHOT=true` |
| 하이라이트/메모 공개 범위 | 나만 보기(개인 전용, 확정) | `FEATURE_PUBLIC_HIGHLIGHTS=false` |
| 삭제 정책 | 즉시 삭제+확인 모달 | `FEATURE_SOFT_DELETE=false` |
| AI 한도 초과 대응 | 에러 안내만 | `FEATURE_AI_FALLBACK=false` |
| 서비스명 | 테크아카이브 | `NEXT_PUBLIC_SERVICE_NAME=테크아카이브` |
| 독후감 강제성 | 완전 필수 | `FEATURE_NOTE_REQUIRED=true` |
| 로그인 방식 | 구글 로그인만 지원(확정) | — |
| 콘텐츠 대상 기업 | 꾸준히 올리는 기업만(확정) | — |
| 과거 글 수집 범위 | 2025-07-01 이후 발행 글만(확정) | — |

## 규칙
@.claude/rules/code-style.md
@.claude/rules/testing.md
@.claude/rules/api-conventions.md
@.claude/rules/design-system.md
