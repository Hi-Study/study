# 기획 스터디 — Expo + Supabase (뼈대)

`claude_code_handoff/dev` 문서를 기준으로 잡은 **초기 골격**입니다. 화면(UI)은 아직
없습니다 — 앱 초기화·폴더 구조, Supabase 연결, DB 마이그레이션(테이블·RLS·RPC)까지.

## 폴더 구조
```
study-app/
├─ App.tsx                  # 부트스트랩 셸(세션·폰트 준비 상태만 표시 · 화면 없음)
├─ index.ts                 # registerRootComponent 진입점
├─ app.json                 # Expo 설정
├─ .env.example             # Supabase 연결 값 템플릿
├─ assets/fonts/            # Pretendard 파일 넣는 곳(넣으면 fonts.ts 주석 해제)
├─ src/
│  ├─ lib/
│  │  ├─ env.ts             # EXPO_PUBLIC_* 로더
│  │  ├─ supabase.ts        # Supabase 클라이언트(AsyncStorage 세션 영속)
│  │  ├─ queryClient.ts     # TanStack Query 클라이언트
│  │  ├─ queryKeys.ts       # Query 키 팩토리(무효화 단일 출처)
│  │  └─ storage.ts         # 직접 작성 글 이미지 업로드 헬퍼
│  ├─ auth/
│  │  ├─ useSession.ts      # 익명 인증 부트스트랩 훅
│  │  └─ AuthProvider.tsx   # 세션/uid 컨텍스트(useAuth / useUid)
│  ├─ providers/
│  │  ├─ AppProviders.tsx   # QueryClient + Auth + Theme 조합
│  │  └─ ThemeProvider.tsx  # OS/사용자 라이트·다크 테마
│  ├─ theme/                # 디자인 토큰(어버진 실제 적용값) → JS 객체
│  │  ├─ colors.ts          # light/dark 색상
│  │  ├─ tokens.ts          # spacing/radius/typography
│  │  ├─ fonts.ts           # Pretendard 로딩 훅(현재 시스템 폰트 폴백)
│  │  └─ index.ts
│  ├─ data/                 # ★ 데이터 접근 계층(TanStack Query 훅, dev/api.md 매핑)
│  │  ├─ profile.ts         # 프로필 조회/수정, 테마 저장
│  │  ├─ studies.ts         # 내 스터디·멤버·생성/참여/위임/나가기(RPC)
│  │  ├─ shares.ts          # 공유 글 무한스크롤·등록·OG/요약 invoke
│  │  ├─ discussions.ts     # 토론 목록(월 이동)·생성·결론 고정
│  │  ├─ comments.ts        # 댓글/대댓글 조회·작성·삭제
│  │  ├─ likes.ts           # 좋아요 토글(낙관적 업데이트)·카운트
│  │  ├─ notifications.ts   # 알림 목록·읽음 처리
│  │  ├─ dashboard.ts       # 마이페이지 집계(참여/공유/의견/미참여)
│  │  └─ index.ts           # 배럴
│  ├─ types/
│  │  ├─ database.ts        # Supabase 스키마 타입(수기 → 추후 CLI 생성으로 대체 가능)
│  │  └─ tables.ts          # Row/Insert 타입 alias
│  ├─ components/           # (비어 있음) 공용 UI
│  ├─ hooks/                # (비어 있음) UI 훅
│  └─ screens/              # (비어 있음) 화면 — design/README.md 스펙대로 이식 예정
└─ supabase/
   ├─ migrations/           # 0001 테이블 · 0002 함수/트리거/RPC · 0003 RLS
   ├─ functions/            # Edge Functions 스텁: og-preview · summarize · notify-cron
   └─ README.md             # 백엔드 적용 가이드 + 의도적 스키마 추가 근거
```

## 시작하기

### 1) 의존성 설치
```bash
cd study-app
npm install
# Expo SDK 에 맞춰 네이티브 패키지 버전을 정렬(중요):
npx expo install
```
> `package.json` 의 버전은 Expo SDK 52 기준 근사치입니다. `npx expo install` 이
> SDK 에 맞는 정확한 버전으로 맞춰줍니다.

### 2) Supabase 연결
1. Supabase 프로젝트 생성 후 `supabase/README.md` 대로 마이그레이션 적용.
2. **Authentication → Providers → Anonymous sign-ins 활성화**.
3. `.env.example` → `.env` 복사 후 값 입력:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```

### 3) 실행
```bash
npx expo start
```
Expo Go 로 열면 **"뼈대 준비 완료 · 익명 세션 연결됨"** 과 uid 가 보이면 연결 성공입니다.

## 기술 스택 (dev/README §1)
- **Expo (React Native)** · TypeScript
- **Supabase JS** (Postgres + Auth + Storage + Edge Functions)
- **TanStack Query** (서버 상태)
- **lucide-react-native** (아이콘) · **Pretendard**(expo-font, `assets/fonts/` 에 파일 추가 시 활성화)

## 완료된 뼈대
- [x] Expo 초기화 · 폴더 구조 · TypeScript
- [x] Supabase 클라이언트 · 익명 인증 부트스트랩(AuthProvider)
- [x] 디자인 토큰(어버진 라이트/다크) → 테마 객체
- [x] DB 마이그레이션(테이블 · RLS · RPC 5종)
- [x] 데이터 접근 계층(`src/data`) — dev/api.md 매핑 TanStack Query 훅
- [x] Edge Functions 스텁 — `og-preview` · `summarize` · `notify-cron`
- [x] Storage 이미지 업로드 헬퍼 · 폰트 로딩 와이어링(파일만 넣으면 활성화)

## 다음 단계 (아직 안 함)
- [ ] 네비게이션 도입(react-navigation 또는 expo-router) 후 `AppProviders` 아래 연결
- [ ] `src/screens` 에 화면 이식(design/README.md 스펙 + 프로토타입 참조 코드)
- [ ] `src/components` 공용 UI(토큰 기반 Avatar/Card/Pill/TabBar 등)
- [ ] Edge Functions 실제 로직 채우기(OG 파싱 견고화 · LLM 요약 · 알림 판정)
- [ ] `expo-notifications` 푸시 토큰 저장 테이블 + 등록/발송
- [ ] Pretendard 파일 추가 후 `src/theme/fonts.ts` 활성화
