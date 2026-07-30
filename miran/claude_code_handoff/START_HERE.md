# 기획 스터디 — 클로드 코드 전달 패키지

이 zip은 **기획 스터디 앱**을 실제로 개발·배포하기 위한 전달물입니다. 아래 순서로 읽고 진행하세요.

## 폴더 구성
- **`dev/`** — 개발 가이드 (여기부터)
  - `README.md` — 기술 스택(Expo + Supabase) · 배포 순서 · 화면↔구현 매핑
  - `schema.md` — DB 테이블 · RLS · 파생 쿼리
  - `api.md` — 화면별 엔드포인트 · 권한 · **확정 정책**(코드/나가기/알림/검증/AI 요약)
- **`design/`** — 디자인 정본 + 참조 코드
  - `README.md` — 화면별 상세 스펙 · 인터랙션 · 디자인 토큰(어버진 실제 적용값)
  - `design_files/study-app/*.txt` — **프로토타입 참조 코드**(`index.html.txt` + 각 화면 `.jsx.txt`). 브라우저에서 열어볼 땐 확장자를 `.html`/`.jsx`로 되돌린 뒤 원본 프로젝트 트리에서 실행
  - `design_system/` — 토큰 CSS

## 진행 순서
1. **Supabase 프로젝트 생성** → `dev/schema.md` SQL 실행(테이블·RLS·RPC).
2. **Auth** 설정 + `users` 자동생성 트리거.
3. **Edge Functions** 배포: `og-preview`, `summarize`(무료 LLM), `notify-cron`.
4. **Expo 앱**: `design/README.md` 스펙대로 화면 이식, `dev/api.md` 매핑 따라 Supabase 연결.
5. 푸시(`expo-notifications`) → `eas build -p ios|android` → TestFlight/Play. 웹은 Next.js + Vercel(선택).

## 비용 (중요)
- **개발·테스트는 0원 · 카드 등록 불필요.** Supabase / Gemini·Groq·Cloudflare(AI) / Expo / Vercel 모두 무료 티어로 시작.
- **월 무료 한도 초과 시 = 자동 결제가 아니라 사용 중지(429/일시정지).** 카드를 등록하지 않는 한 과금 불가.
- 돈이 드는 건 (1) 앱스토어 정식 출시(Apple $99/년 · Google $25), (2) 본인이 직접 유료 업그레이드할 때뿐.

## 가입 필요 서비스 (무료, 카드 불필요)
- Supabase(GitHub 계정) · AI LLM 1곳(Google Gemini 등) · Expo(이메일) · Vercel(웹, 선택)

## 핵심 확정 정책 (요약)
- 초대 코드: **만료 없음**(재발급 전까지 유효), 이미 참여 시 안내 후 이동.
- 방장 나가기: **가장 오래된 멤버에게 자동 위임** 후 퇴장(마지막 멤버면 삭제).
- 토론 알림: **스터디 전원**(전원 참여 전제). 신고 없음 → **방장 삭제 권한**으로 중재.
- 직접 작성 글 **이미지 업로드** 허용, 목록 **무한 스크롤**, **기본 폼 검증**.
- **AI 요약**: 서버 Edge Function + 무료 LLM(Gemini/Groq/Cloudflare) — 실패 시 제목·메모 폴백.

자세한 내용은 `dev/` 3개 문서를 기준으로 하세요.
