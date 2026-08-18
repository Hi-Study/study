# 배포 가이드 (Vercel)

이 앱은 모노레포(`Hi-Study/study`)의 서브폴더 `hyeran/insight-app`에 있는 Next.js 15 앱이다.
아래는 처음 한 번만 하면 되는 세팅. 이후엔 브랜치에 push 하면 Vercel이 자동 배포한다.

## 0. 배포 전 체크 (이미 완료됨)
- `.env.local`은 git 제외됨(시크릿 안전). 배포용 값은 Vercel 환경변수로 넣는다.
- `next/image` remote 설정 불필요(일반 `<img>` 사용).
- 미들웨어(`src/middleware.ts`) — Vercel 기본 지원.
- 로그인 리다이렉트는 `window.location.origin` 기반이라 도메인 자동 적응(하드코딩 없음).
- `serverExternalPackages: ["jsdom", "@mozilla/readability"]` — 서버리스에서 무거운 패키지 외부화.

## 1. Vercel 프로젝트 생성
1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New… → Project** → `Hi-Study/study` 리포 **Import**
3. **Root Directory** 를 반드시 `hyeran/insight-app` 로 지정 (모노레포이므로 필수)
   - Framework Preset: **Next.js** (자동 감지)
   - Build/Output/Install: 기본값 그대로
4. **Production Branch**: 기본 `main`. 지금 작업 브랜치(`design/minimax-refresh`)를 먼저
   배포해 확인하려면, 생성 후 Settings → Git 에서 Production Branch를 바꾸거나
   `main`으로 머지 후 배포한다.

## 2. 환경변수 (Vercel → Settings → Environment Variables)
로컬 `.env.local`의 값을 그대로 복사해 넣는다. (Production/Preview/Development 모두 체크)

| Key | 설명 |
|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (서버 전용, 노출 금지) |
| `GEMINI_API_KEY` | Google AI Studio 키 (글 등록 시 AI 요약) |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` |
| `NEXT_PUBLIC_SITE_URL` | 배포 후 실제 도메인 (예: `https://insight-app.vercel.app`) |

> `NEXT_PUBLIC_SITE_URL`은 1차 배포로 도메인이 정해진 뒤 그 값으로 채우고 재배포(Redeploy).

## 3. Supabase Auth 허용 도메인 등록 (구글 로그인 필수)
Supabase Dashboard → **Authentication → URL Configuration**
- **Site URL**: `https://<배포도메인>`
- **Redirect URLs**에 추가: `https://<배포도메인>/auth/callback` (와일드카드 `https://<배포도메인>/**` 도 함께)

> 구글 OAuth의 리디렉션 대상은 Supabase 콜백(`https://<project>.supabase.co/auth/v1/callback`)이라
> Google Cloud 쪽은 로컬에서 이미 설정돼 있으면 추가 작업 불필요.

## 4. 배포 & 확인
- Import 시 자동으로 첫 배포됨. 이후 push마다 자동 재배포(Preview: 브랜치, Production: 프로덕션 브랜치).
- 배포 URL 접속 → 구글 로그인 → 홈 정상 노출 확인.

## 5. (선택) 수집 스크립트
`scripts/collect.mjs`(RSS 수집)는 배포 앱과 별개로 **로컬/크론에서** 실행한다.
Vercel 서버리스에서 장시간 크롤링은 부적합. 로컬에서 `node scripts/collect.mjs` 로 돌리면
같은 Supabase DB에 쌓이므로 배포 앱에 바로 반영된다.

<!-- deploy: trigger fresh production build -->
