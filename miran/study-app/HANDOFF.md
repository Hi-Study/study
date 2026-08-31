# distill 앱 — 수정 인수인계 (다음 세션용)

> 이 문서 하나만 새 세션에 주면 이어서 작업 가능. 프로젝트: `miran/study-app` (Expo SDK 54 + Supabase).
> 검증 게이트(필수): `npx tsc --noEmit`(0 오류) + `npx jest --silent`(현재 102 통과) 통과 후에만 완료.
> 직전 커밋: `ae1900d`. **① 항목은 이번 세션에서 모두 코드 반영됨(미커밋 작업트리 상태).**

---

## ① 코드로 고칠 것 — 이번 세션 반영 완료

### 1-1. 인사이트 카드에 3항목 전체 표시 ✅
- `InsightBody` 의 `compact` 의미를 바꿈: **"항목 수를 줄이는 모드" → "항목별 길이를 줄이는 모드"**.
  즉 값이 있는 항목(핵심/인상적인 문장/내 해석/접목/비슷한 사례/떠오른 질문)은 **항상 전부** 타이틀+내용으로
  보이고, 카드에서는 항목당 3줄 · 질문 2개까지만 미리보기(`+N개 더`).
- 위치: `src/components/distill/InsightBody.tsx`, 호출부 `src/components/distill/OpinionCard.tsx`.
- 커뮤니티 자유글 카드(`DiscussScreen`)·글 상세도 같은 컴포넌트라 자동 반영.

### 1-2. 필터 칩 "잘림" ✅ (근본 원인 수정)
- **원인**: `dtype.label` 이 `fontSize 12 / lineHeight 14`. 안드로이드 RN 은 lineHeight 를 줄 높이 **상한**으로
  강제해서 한글이 위아래로 잘린다. 게다가 호출부가 `{...dtype.label, fontSize: 13~14}` 처럼 **fontSize 만**
  덮어써서(칩·카운트·작성자명 등) 실제로는 `fontSize 14 / lineHeight 14` 인 곳이 여럿 있었다.
- **수정**: `src/theme/distill.ts` 의 타입 스케일 전체를 **lineHeight ≥ fontSize × 1.35** 로 조정
  (`label 14→20`, `meta 16→17`, `cardTitle 22→23`, `title 24→26`, `titleL 28→30`, `display 34→38`).
  주석으로 규칙을 못박아 뒀으니 앞으로 스케일 추가 시 지킬 것.
- 추가로 필터 칩 자체도 `minHeight 36` + `justifyContent:center`, 칩 바 ScrollView `flexGrow:0` 로 고정.
- 실기기(Expo Go)에서 재확인 필요.

### 1-3. 피드/인사이트 필터 = **현대백화점식** 큰 기업 드롭다운 + 하위 필터 ✅
> 컬리식 칩 나열이 아니라, **더현대 서울 스토어 선택**처럼 기업 드롭다운이 화면에서 제일 큰 요소.

- `src/components/distill/FilterSheet.tsx` 구조:
  1. **큰 기업 드롭다운** — 작은 안내문("지금 보는 곳") + `전체 기업 ∨`(display 28, 볼드).
     탭하면 바텀시트에서 기업 전환. **단일 선택**이고 고르는 즉시 적용(스토어 선택과 동일한 감각).
  2. 그 아래 **작은 드롭다운 필터 칩** `[카테고리 ▾] [정렬 ▾]` → 바텀시트(탭 전환)
     · 옵션 행은 **체크(원형)가 맨 왼쪽** → 로고 → 라벨
     · 선택한 카테고리는 칩으로 모아 보여주고 칩 탭으로 해제
     · 하단 바 `[초기화(테두리)] + [N개 글 보기(주색)]`, 세이프에어리어 반영
- **`FilterValue` 타입 변경**: `blogs: Set<string>` → **`blogId: string | null`**(null=전체 기업).
  기본값은 `emptyFilter()` 헬퍼 사용. 사용처: `FeedScreen`, `DiscussScreen`.
- 화면 배치:
  · 피드 = "피드" 제목 제거, 큰 기업 드롭다운이 최상단(검색 아이콘은 그 우측).
  · 인사이트 = 제목을 `dtype.display` → `dtype.title` 로 낮춰서 기업 드롭다운이 제일 크게 보이도록.
- 미사용 잔재 `BlogChipsBar.tsx` / `BlogDropdown.tsx` **삭제 완료**.

### 1-4. 홈 "맞춤 추천글 / 인기 인사이트 / 읽다만 글" 폴백 ✅
- 추천글 없으면 → **이미지 있는 최신 글**(`useFeaturedArticles`)로 폴백 + 제목 "새로 올라온 글이에요".
  (③ 인기 글과 중복되지 않게 popular 가 아닌 최신을 씀.)
- 인기 인사이트 없으면 → **최신 인사이트**로 폴백 + 제목 "방금 올라온 인사이트예요".
- 읽다만 글 없으면 → 섹션은 유지하고 **안내 카드**("글을 끝까지 읽으면 여기에 모여요") 표시.
- 위치: `src/screens/distill/DistillHomeScreen.tsx`.

### 1-5. "이 기업 인기글" 정렬 — DB 컬럼 없어도 안 깨지게 ✅
- 인기순 정렬은 `view_count → like_count → opinion_count → published_at → id` 그대로 유지하되,
  **컬럼이 없어 42703(undefined_column) 이 나면 `like_count → published_at → id` 로 자동 재시도**.
  의견 피드(`listOpinionsFeed`) 인기순도 `like_count` 없으면 최신순 폴백.
- 위치: `src/lib/pgError.ts`(신규 판별 헬퍼), `src/data/articles.ts`, `src/data/opinions.ts`.
- 테스트: `src/data/__tests__/articles.test.ts`, `src/data/__tests__/opinions.test.ts` (신규 6개).
- ※ 폴백은 **화면이 비지 않게 하는 안전망**일 뿐 — 조회수/인사이트수 지표를 제대로 보려면 ②-1 SQL 재실행 필요.

### 1-6. 피드/인사이트 상단을 **히어로 카드**로 (덜렁 붙은 큰 텍스트 X) ✅
- 큰 기업명이 화면 맨 위에 그냥 얹혀 있던 걸, 현대백화점 이미지처럼 **카드 블록 안**으로 넣음:
  `[상단 유틸 아이콘 줄] → [히어로 카드: "지금 보는 곳" + 기업명 ∨ + 브랜드 로고 + 인사 배너]`
- 인사 배너 = 주색 배경 + `"{이름}님 안녕하세요! / {기업}의 글 N개를 모았어요."`(이미지의 초록 배너 자리).
- 덕분에 큰 텍스트가 카드 여백만큼 아래로 내려온다. 위치: `src/components/distill/FilterSheet.tsx`.

### 1-7. 자유글 = **제목 + 내용만** ✅ (감상문 항목 원복)
- `CreateCommunityPostScreen` 에서 인사이트(핵심/접목/질문) 항목 제거 → 제목 + 본문 입력만.
- 커뮤니티 카드도 본문 미리보기 우선(예전에 감상문 폼으로 쓴 글만 `insight` 폴백).
- 독후감 항목이 있는 글은 **"인사이트 공유"(CreateArticle)** 로 쓰는 것으로 역할 분리.
- ※ `community_posts.insight` 컬럼은 레거시 데이터용으로 남겨둠(스키마 변경 없음).

### 1-8. 마이 활동 캘린더 — 날짜 탭 이동 + 원형 표시 ✅
- 날짜를 누르면 **그날의 활동 화면**(`DayActivity`)으로 이동. 인사이트/하이라이트/댓글/단어/읽은 글을
  섹션별로 보여준다. 별도 쿼리 없이 마이 탭이 쓰는 `useMy*` 훅 결과를 날짜로 필터링.
  - 신규: `src/screens/distill/DayActivityScreen.tsx`, 라우트 `DayActivity: { date: 'YYYY-MM-DD' }`.
- 활동 표시를 확실한 **원**으로(`borderRadius: 999` + 32×32 + overflow hidden). 달 이동 화살표 터치영역 36×36.
- `listMyReads` 가 **읽은 날짜(`read_at`)** 를 함께 반환하도록 변경 → 캘린더에 "읽은 날"도 포함.

### 1-9. 커뮤니티 자유글 — 좋아요 + 댓글 + 대댓글 ✅ **(SQL §23 필요)**
- 새 댓글 테이블을 만들지 않고 **`opinion_comments` 를 범용 댓글 테이블로 확장**했다.
  `opinion_id | community_post_id` 중 하나만 채우는 방식(check 제약) → 스레드·대댓글·좋아요·수정/삭제
  로직을 인사이트와 그대로 공유한다.
- 좋아요: `reactions.target_type` 에 `'community'` 추가 + `community_posts.like_count` 동기화 트리거.
- 신규 화면 `CommunityPostDetailScreen`(자유글 상세) + 라우트 `CommunityPostDetail: { postId }`.
  커뮤니티 카드는 탭하면 상세로 가고, 카드에 좋아요·댓글 수를 표시.
- 데이터 계층: `listThreadComments/createThreadComment` + `useThreadComments/useCreateThreadComment/...`
  (기존 `useOpinionComments` 등은 얇은 래퍼로 유지 — 호출부 무변경).
- "내 댓글"(마이·그날 활동)은 인사이트/자유글이 섞이므로 `commentSource(row)` 로 원본 종류를 판별해 이동.
- ⚠ 커뮤니티 댓글은 **알림 대상이 아니다**(`app_notifications` 가 opinion 기준). 트리거에서 명시적으로 건너뛴다.

### 1-10. 대댓글(답글) 작성 — 인사이트에도 없던 것 추가 ✅
- 기존 `OpinionThread` 는 `parent_id` 를 **읽기만** 하고 답글을 만들 방법이 없었다(대댓글 작성 불가).
- 댓글마다 "답글" 버튼 → 입력창 위에 `○○님에게 답글` 바 표시(X로 해제) → `parentId` 로 생성.
- 2단계 이상 중첩은 만들지 않는다(대댓글의 답글은 같은 부모에 붙음). 정렬은 부모 바로 아래.
- 컴포넌트명: `CommentThread`(범용) + `OpinionThread`(인사이트용 래퍼).

### 1-11. 기업 선택 다중 선택 복원 ✅
- `FilterValue.blogId: string | null` → **`blogIds: Set<string>`**. 히어로 큰 텍스트는
  `전체 기업` / `토스` / `토스 외 2곳` 으로 표시(로고는 1개 선택일 때만).
- 기업 시트도 다중 체크 + 하단 `[초기화] [N개 기업 보기]` 로 적용(카테고리 시트와 동일한 감각).

### 1-12. 필터 칩 하단 여백 + 오늘 날짜 흰 글씨 ✅
- 카테고리/정렬 칩 바 `paddingBottom 4 → 12`(+ 오른쪽 여백) — 칩이 잘려 보이던 문제.
- 캘린더: **오늘도 채운 원 + 흰 글씨**(활동 없는 오늘은 opacity 0.45로 연하게 구분).
  기존엔 활동 없는 오늘이 테두리+보라 글씨라 잘 안 보였다.

### 1-13. 검색 결과에도 필터 — 기업은 **카테고리 칩과 같은 디자인** ✅
- `FilterSheet` 에 `variant` prop 추가:
  - `"hero"`(기본, 피드·인사이트) = 큰 기업 드롭다운 히어로 카드 + `[카테고리][정렬]` 칩
  - `"chips"`(검색) = 히어로 없이 **`[기업 ▾] [카테고리 ▾] [정렬 ▾]` 칩 3개**.
    기업도 카테고리와 같은 칩 디자인이고, 바텀시트의 '기업' 탭에서 다중 체크 → "N개 글 보기".
- `DistillSearchScreen` 은 검색어 + 필터(기업/카테고리/정렬)를 함께 걸어 결과를 조회하고 개수를 표시.

### 1-14. 홈 "커뮤니티에서 이야기 나누고 있어요" — 카드 캐러셀로 ✅
- 기존엔 제목/본문 한 줄씩 나열한 **텍스트 목록**이었고 **탭해도 이동이 안 됐다**(Pressable 아님).
  정렬도 최신순이라 섹션 제목("이야기 나누고 있어요")과 안 맞았다.
- `CommunityCard` 를 `src/components/distill/CommunityCard.tsx` 로 **공용 컴포넌트 분리**
  (인사이트 탭 커뮤니티 서브탭 + 홈 캐러셀이 같은 카드 사용).
- 홈은 다른 섹션과 동일한 가로 카드 캐러셀(`OPINION_W`), 탭하면 자유글 상세로.
- 정렬 `useCommunityPosts("active")` = **댓글 수 → 좋아요 수 → 최신**. 이를 위해
  **SQL §23-3 `community_posts.comment_count`** + 트리거 추가(§23에 포함 — 별도 실행 불필요).
  컬럼이 없으면 최신순으로 자동 폴백한다.
- 카드의 댓글 수도 `comment_count` 컬럼을 쓴다(예전엔 카드마다 댓글 쿼리를 날렸음 — N+1 제거).

---

## ② 코드 아님 — 데이터/환경 (반드시 먼저)

### 2-1. Supabase SQL 재실행 **필수** (최신본 §23 추가됨)
`supabase/distill_schema.sql` **전체를 다시 실행**(재실행 안전).
- §20 `community_posts` (커뮤니티 자유글)
- §21 `articles.view_count` / `opinion_count` + `increment_article_view` RPC + 트리거 (카드 조회수·인사이트수)
- §22 `community_posts.insight` (레거시 자유글 감상문)
- **§23 (이번 추가)** 자유글 좋아요(`reactions` 에 `'community'` + like_count 트리거) ·
  `opinion_comments.community_post_id` + `opinion_id` NULL 허용 + check 제약 · 알림 트리거 수정
- **안 하면**: 커뮤니티 좋아요/댓글이 저장 실패(에러), 카드 조회수/인사이트수 0, 인기순 폴백 동작.

### 2-2. 지금 Expo Go는 "게스트" 모드 (구글 로그인 X)
- EAS 무료 빌드 한도 소진(9/1 리셋)으로 **Expo Go**로 확인 중. 개발모드(`__DEV__`)에서 **익명 세션 자동 로그인**
  처리해둠(`src/auth/useSession.ts`, `src/navigation/RootNavigator.tsx`).
- **부작용**: 게스트라 읽은 글·내 인사이트·즐겨찾기 활동이 0 → 맞춤/읽다만 섹션이 빈다.
  → ①-4 폴백으로 **더 이상 섹션이 사라지지는 않음**(다른 내용으로 채워짐).
- 운영 APK(구글 로그인)에선 정상.

### 2-3. Expo Go 실행
- 폰: Expo Go 설치 → 컴퓨터: `npx expo start`(같은 Wi-Fi/핫스팟) 또는 `npx expo start --tunnel`(다른 망/5G) → QR 스캔.
- "something went wrong" = 대개 **연결 끊김/서버 미실행** (번들은 정상 확인됨). `npx expo start -c` 로 재시작.

---

## ③ 이미 반영됨 (SQL 재실행 + 최신 코드로 보면 확인 가능)
- AI 요약 3관점 복구(Groq 모델 `openai/gpt-oss-120b/20b`로 교체) + 단어 뜻풀이 + 429 재시도.
- 배민 이미지(한글 URL 인코딩 `safeImageUri`), 이미지 추출 견고화. AWS는 `node scripts/recollect.mjs aws` 재수집 필요.
- 임시저장 **완전 제거**(작성화면 버튼/로직 + 마이 세그먼트/컴포넌트).
- 알림 고도화(종류 탭 전체/새글/댓글 + "새 알림"/"지난 알림" 섹션).
- 자유글 = 인사이트와 동일 감상문 항목 폼(+`community_posts.insight`), 커뮤니티 카드 InsightBody.
- 홈 태그칩 클릭 → 그 태그 **검색결과**(`Search` q 파라미터).
- 이미지 없는 카드 → 브랜드 로고로 채움.
- 글 상세: 인사이트 **전체 항상 펼침** + 좋아요 항상 노출 + "토론"→"댓글" 워딩.
- 기업 상세: 헤더 큰 볼드+∨(현대백화점식), 전환은 바텀시트.
- 탭 4개(홈/피드/인사이트/마이), 검색 상단 유틸, 팔로우 제거·알림 유지, 읽기시간(N분) 제거,
  카드 지표(조회수·인사이트수·북마크), 마이 활동 캘린더.

---

## ④ 프로젝트 규약 (지킬 것)
- 데이터 접근은 `src/data/*` 계층만(화면에서 supabase 직접호출 X). 테마 토큰 `src/theme/*`.
- **타입 스케일 규칙**: lineHeight ≥ fontSize × 1.35 (안드로이드 한글 잘림 방지). `src/theme/distill.ts` 주석 참고.
- 커밋 전 `.env`/`eas.json`/secret/.log 스테이징 여부 점검. 커밋: `git add miran/study-app/src [supabase]`.
- 디자인 정본: `miran/study-app/DESIGN_SYSTEM.md`.
