# 기획 스터디 — 개발 핸드오프 (Front + Back + DB → 앱 배포)

이 문서는 `ui_kits/study-app/` 프로토타입을 **실제 앱**으로 구현·배포하기 위한 개발 가이드입니다. 디자인/토큰/화면 흐름의 원본은 프로토타입과 이 디자인 시스템(`styles.css`, `readme.md`)을 기준으로 합니다.

## 1. 기술 스택 (권장)

| 레이어 | 선택 | 이유 |
|---|---|---|
| 앱 | **React Native + Expo** | iOS/Android 동시, EAS로 빌드·배포 간단. 프로토타입이 이미 iOS 프레임 기준 |
| 상태/데이터 | **TanStack Query** + Supabase JS | 서버 상태 캐싱·낙관적 업데이트 |
| 백엔드+DB | **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) | 인증·DB·실시간·파일·서버함수 통합, 스터디 규모에 최적 |
| 푸시 | **Expo Notifications** + Supabase Edge Function(cron) | 미참여·공유주기·댓글 알림 |
| 링크 프리뷰 | Supabase **Edge Function** (OG 메타 파싱) | 클라에서 CORS로 불가 → 서버에서 처리 |

> 웹으로도 낼 거면 앱 코드 대신 **Next.js**(App Router) + 동일 Supabase 백엔드. 컴포넌트 구조는 그대로 재사용.

## 2. 폰트 / 디자인 토큰
- 폰트: **Pretendard** (`react-native`는 `expo-font`로 번들, 웹은 `styles.css`의 CDN 그대로).
- 토큰: `tokens/*.css`의 값은 Apple 파생 원본(대체 전)이며, **앱 실제 적용값은 `ui_kits/study-app/index.html`의 `.app-scope` 오버라이드(Slack 어버진)**입니다. JS 테마 객체로 옮길 때 이 어버진 값을 쓰세요. 예: `colors.primary = "#4a154b"`, `colors.link = "#1264a3"`.
- 아이콘: **lucide-react-native** (프로토타입의 탭/벨/톱니/하트가 모두 Lucide 계열).

## 3. 구현 매핑 (프로토타입 화면 → 실제)
- `MyStudies` → 홈: 참여 스터디 목록 + 벨(알림) + 톱니(스터디 관리)
- `StudyCalendar` → 스터디 상세: 월 달력, 날짜별 공유 글 (dot)
- `Weekly` → 이번 주: 요일 스트립(월~일) + 선택일 공유 글
- `DiscussionList` / `DiscussionDetail` → 주차별 토론(월 이동·검색) / 상세(대댓글·방장 결론)
- `ShareDetail` / `CreateShare` → 공유 글 상세(OG 프리뷰/본문·좋아요·댓글) / 등록(링크·직접)
- `CreateDiscussion` → 토론 등록(외부 링크·직접)
- `MyPage` / `ProfileEdit` / `DisplaySettings` → 내 활동 대시보드 / 프로필(이름·직급) / 밤낮 모드
- `Members` → 멤버 목록·권한(강퇴·위임)·초대코드 재발급·공유주기

핵심 규칙은 `schema.md`(데이터), `api.md`(엔드포인트/권한) 참고.

## 4. 배포 순서
1. **Supabase 프로젝트 생성** → `schema.md`의 SQL 실행(테이블·RLS·함수).
2. **Auth** — 앱에 로그인 화면이 없으므로 **Anonymous Auth**(화면 없이 첫 실행 시 사용자 자동 생성). `users` 프로필 트리거로 자동 생성(이름 '게스트'). 이름·직급은 마이페이지에서만 편집.
3. **Edge Functions** 배포: `og-preview`, `notify-cron`(스케줄).
4. **Expo 앱**: `supabase-js` 연결(anon key), 화면 이식, `expo-notifications` 등록.
5. 빌드·배포: `eas build -p ios|android` → **TestFlight / Play Console**. 웹은 Vercel.

## 5. 이 환경에서의 한계
- 여기서는 실제 빌드/배포·서버 실행이 불가합니다. 위 코드/스키마를 로컬 또는 Claude Code로 가져가 실행하세요.
- 원하시면 **Expo 스타터 코드**(화면 스캐폴드 + Supabase 클라이언트)도 파일로 만들어 드립니다.
