# 기획 스터디 앱 — 프로젝트 규칙 (CLAUDE.md)

이 파일은 이 코드베이스에서 작업하는 모든 세션이 따르는 **고정 규칙**입니다.
사용자는 비개발자이며, 원본 기획/디자인은 상위 폴더 `../claude_code_handoff/` 에 있습니다.

## 언어
- 사용자와의 모든 소통·설명·주석은 **한국어**. 코드 식별자(변수·함수·타입)는 원문 유지.

## 무엇을 만드는가
- **Expo(React Native) + Supabase** 모바일 앱. 기획 관련 글을 요일별로 공유하고 주차별로 토론하는 스터디 커뮤니티.
- 정본 문서(반드시 이걸 기준으로):
  - `../claude_code_handoff/dev/schema.md` — DB 테이블·RLS·정책
  - `../claude_code_handoff/dev/api.md` — 화면별 동작·권한·확정 정책
  - `../claude_code_handoff/design/README.md` — 화면별 상세 스펙·디자인 토큰
  - `../claude_code_handoff/design/design_files/study-app/*.jsx.txt` — 화면 프로토타입 참조 코드

## 디자인 규칙 (중요)
- **임의로 디자인하지 않는다.** 프로토타입과 토큰 정본을 그대로 재현한다(hifi).
- 색/간격/라운드는 **어버진(Slack aubergine) 실제 적용값**을 사용. 소스는 `src/theme/`
  (원본은 `index.html` 의 `.app-scope`/`.app-dark`). 예: primary `#4a154b`, link `#1264a3`.
- 아바타 배경은 이름 해시 `hsl(h,34%,44%)` (`src/lib/color.ts`).
- 아이콘은 `lucide-react-native`. 폰트는 Pretendard(`src/theme/fonts.ts`, 파일 추가 시 활성).

## 아키텍처 규약
- **데이터 접근은 반드시 `src/data/*` 계층을 통해서만.** 화면에서 `supabase` 를 직접 부르지 않는다.
  - 각 도메인 파일은 `raw 함수`(순수 async) + `use* 훅`(TanStack Query) 을 함께 export.
  - 캐시 무효화 키는 `src/lib/queryKeys.ts` 단일 출처.
- **화면은 vertical slice 로 구현**: 화면 UI + 데이터 연결(+상호작용)을 한 세트로 만든다.
  화면 UI만 따로, 기능만 따로 만들지 않는다.
- 공용 UI는 `src/components/*`, 테마 토큰은 `src/theme/*` 사용. 하드코딩 hex 최소화(토큰 우선).
- 네비게이션: `src/navigation/*` (RootStack + Study 내부 BottomTab). 타입은 `navigation/types.ts`.
- `useUid()`/`useStudyId()` 는 세션·스터디 준비된 문맥에서만 사용(없으면 예외). 화면은 게이트 아래 마운트.

## 스키마 관련 — 의도적 추가 (schema.md 대비)
- `comments.study_id`, `likes.study_id` — RLS 멤버십 검사 단순화용 비정규화. **insert 시 반드시 채운다.**
- `shares.ai_summary` — AI 요약 캐시(api.md §3).
- 상세 근거: `supabase/README.md`.

## 개발 워크플로우
- 자세한 절차는 `WORKFLOW.md`. 요약: 스펙 확인 → 구현(화면+기능 한 세트) → **검증 게이트** → 통과 시 커밋.
- **검증 게이트(반드시 통과 후 완료 선언)**:
  ```
  npm run typecheck   # 타입 오류 0
  npm test            # Jest 통과
  ```
  이 게이트는 **Claude(개발자)가 직접 실행**한다. 사용자에게 수동 테스트를 요구하지 않는다.
- 실제 폰/실서버(Supabase) 확인은 별도 단계(사용자와 함께 Supabase 세팅 후). 그 전까지 테스트는
  **mock 기반 자동 테스트**로 대체하며, "실제 동작 미확인" 부분은 정직하게 명시한다.

## 커밋 규칙
- 기능 하나 = 게이트 통과 = 커밋 하나(원자적). 한국어 커밋 메시지.
- 커밋·푸시는 사용자 요청 시에만(또는 워크플로우상 기능 완료 시). 기본 브랜치 직접 커밋 지양.

## 하지 말 것
- 화면을 정본 스펙 없이 상상해서 만들기.
- `src/data` 우회하고 화면에서 직접 DB 호출.
- 검증 게이트 통과 없이 "완료"라고 말하기.
