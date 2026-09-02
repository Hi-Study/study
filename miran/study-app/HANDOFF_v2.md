# distill v2 — 기획자·디자이너·마케터가 들어오게 만들기

> 이 문서 하나만 새 세션에 주면 이어서 작업 가능. 프로젝트: `miran/study-app` (Expo SDK 54 + Supabase).
>
> **검증 상태**: `npx tsc --noEmit` 0 오류 · `npx jest` 147개 통과(신규 40개).
> 엣지 함수는 tsconfig 에서 제외돼 게이트가 안 보므로 따로 검사한다:
> ```
> npx tsc --noEmit --skipLibCheck --target es2022 --module esnext \
>   --moduleResolution bundler --allowImportingTsExtensions supabase/functions/**/*.ts
> ```
> (`Cannot find name 'Deno'` · 원격 import 오류는 정상 — 그 외가 0이어야 한다.)

---

## 왜 이 작업을 했나

distill 의 수집 소스 18개가 **전부 기술블로그**였고 `Topic` 에 **마케팅이 아예 없었다.**
기획자·디자이너·마케터가 안 들어오는 1차 원인은 큐레이션 방식이 아니라 **읽을 게 없어서**였다.
그래서 이번 작업은 세 축이다:

1. **읽을 게 있다** — 소스 확장(`blogs.kind`, B컷) + `marketing` 주제
2. **읽을 수 있다** — 난이도 배지 · 본문 조판 · 단어장 개인화
3. **남기기 쉽다** — 인사이트 진입 3단 사다리(초안 / 질문 / 스탬프)

---

## ⓪ 먼저 할 일 (사람이 해야 하는 것)

### 0-1. SQL 실행 — ✅ 2026-09-02 실행 완료
`supabase/distill_schema.sql` 의 **섹션 24~30** 을 Supabase SQL Editor 에서 실행한다.
재실행 안전(idempotent)이라 파일 전체를 붙여넣어도 된다.

| 섹션 | 내용 |
|---|---|
| 24 | `users.job_role` · `users.onboarded_at` · `Topic` 에 `marketing` 추가 |
| 25 | `blogs.kind`(tech/design/product/culture) + **B컷 by 배민** 시드 |
| 26 | `articles.level` · `read_minutes` · `decision` · `question` · `terms` |
| 27 | `article_stamps` 테이블 + RLS + `article_stamp_counts()` |
| 28 | `user_words.domain` · `easy_definition` · `job_role` · `hit_count` + `my_weak_domains()` |
| 29 | `my_reading_stats()` — 연속 읽기 + 이번 달 누적 |
| 30 | `article_reader_roles()` — 직군 배지 |

### 0-2. 엣지 함수 재배포 — ✅ 2026-09-02 배포 완료
```
supabase functions deploy summarize
supabase functions deploy collect
```
배포하려면 Supabase 개인 액세스 토큰이 필요하다
(https://supabase.com/dashboard/account/tokens 에서 발급 →
`SUPABASE_ACCESS_TOKEN` 환경변수). **`.env` 에 남겨두지 말 것.**

### 0-3. 크론 등록 (선택)
`supabase/distill_cron.sql` 의 **4) enrich 잡** 을 실행하면 매시 10분에 미분석 글 5건씩 처리한다.

### 0-4. Pretendard 폰트 — ✅ 적용 완료
TTF 5종(Regular/Medium/SemiBold/Bold/ExtraBold)을 `assets/fonts/` 에 번들했다(약 13MB).
Pretendard 가 OTF 를 제대로 못 다루는 환경용으로 제공하는 `alternative` TTF 를 골랐다
(RN 안드로이드가 그 대표 케이스). Black(900)은 사용처가 2곳뿐이라 ExtraBold 로 매핑.

⚠️ **RN 은 커스텀 폰트가 `fontWeight` 에 반응하지 않는다.** 굵기마다 패밀리가 따로다.
`theme/tokens.ts` 의 `PRETENDARD` 매핑을 써서 `fontWeight` 옆에 **항상 같은 굵기의**
`fontFamily` 를 준다. 빠뜨리면 그 글자만 시스템 폰트로 떨어져 화면이 섞여 보인다.

---

## ① 로그인 버그 — 고침 (커밋 `ae1900d` 회귀)

`__DEV__` 로 익명 세션을 허용하고 있어서 **Expo Go 에서는 구글 로그인 화면이 구조적으로 뜰 수 없었다**
(운영 빌드에서만 정상). `env.allowAnonBrowse` 플래그로 교체했고 **기본값은 꺼짐 = 항상 로그인부터**다.

- `src/lib/env.ts` — `EXPO_PUBLIC_ALLOW_ANON_BROWSE=1` 일 때만 둘러보기 허용
- `src/auth/useSession.ts:47` — 자동 익명 로그인 조건 교체
- `src/navigation/RootNavigator.tsx:83` — 게이트 조건 교체

---

## ② 온보딩 — 직무 받기 (나머지 기능의 전제)

`src/screens/OnboardingScreen.tsx` (신규). 구글 로그인 직후 **1화면**. 직무 + 관심 주제.
`RootNavigator` 에 `OnboardingGate` 를 넣어 `users.onboarded_at` 이 비면 이 화면을 먼저 띄운다.

**직무(job_role) 하나로 아래 셋이 전부 돌아간다** — 그래서 선행 작업이다:
- 역할별 AI 요약(③) · 직군 배지(⑦) · 단어장 개인화(⑥)

---

## ③ 결정 카드 — "테크"가 아니라 "판단"

`articles.decision` = `{problem, constraint, chosen, rejected, metric}`.
수집 후 `summarize` 의 `target:"enrich"` 배치가 채운다.

- `src/lib/decision.ts` — `toDecision` / `hasDecision` / `decisionRows` (순수, 테스트 있음)
- `src/components/distill/DecisionCard.tsx` — 값 없으면 **컴포넌트가 스스로 아무것도 안 그린다**

> ⚠️ **없는 걸 지어내지 않는 게 이 기능의 전부다.** 회고·문화·인터뷰 글(B컷 같은)은
> 트레이드오프 서술이 없어 `decision` 이 null 이 된다. 정상 동작이다.

---

## ④ 역할별 AI 요약

3관점 요약의 **세 번째 제목만** 직무에 따라 바뀐다(앞 두 개는 파싱 기준이라 고정).
캐시 키도 `insight_<직무>` 로 분리 — 안 그러면 직무끼리 서로 덮어쓴다.

- `src/lib/summary.ts` — `ROLE_INSIGHT_TITLE` / `insightTitleForRole` / `insightCacheKey`
- `supabase/functions/summarize/index.ts` — `insightSysFor(jobRole)`
- ⚠️ 앱과 엣지 함수의 `ROLE_INSIGHT_TITLE` **문자열이 정확히 같아야 파싱된다.** 한쪽만 고치지 말 것.

---

## ⑤ 인사이트 진입 3단 사다리

지금까지는 사다리 **맨 위 칸(6칸 빈 폼)만** 있어서 대부분 거기서 나갔다.

| 상황 | 보여주는 것 | 사용자 부담 | 구현 |
|---|---|---|---|
| 하이라이트를 그었다 | 초안이 채워진 폼 | 고치기만 | `lib/insightDraft.ts` + `CreateOpinionScreen` |
| 하이라이트 없음 | 질문 1개 | 한 문장 | `lib/decision.ts` + `ArticleDetailScreen` |
| 둘 다 부담 | 스탬프 4개 | 탭 한 번 | `components/distill/StampBar.tsx` |

### 질문 1개 — **자유 생성이 아니라 조립**
자유 생성은 "이 글의 핵심은?" 같은 어느 글에나 붙는 질문을 낳아 아무도 답하지 않는다.
그래서 `decision.chosen` / `decision.rejected` 가 **둘 다 있을 때만** 조립하고,
`isUsableQuestion()` 게이트(두 선택지가 문장에 살아 있는지)를 통과한 것만 화면에 띄운다.

### 스탬프가 뒤에서 하는 일
- 💡 `apply` → 홈 "바로 써먹은 사례" 섹션의 재료
- 🎯 `reason` → 결정 카드가 잘 뽑혔는지 확인하는 신호
- 🤔 `disagree` → "같이 읽는 글"에 넣기 좋은 논쟁적인 글
- 😵 `hard` → 이 글에 용어 예고가 필요하다는 신호(단어장 연결)

---

## ⑥ 단어장 개인화

**단어를 누른 것 자체가 "이 영역에 약하다"는 신호다.** 비개발자 전용이 아니다 —
개발자가 '리텐션/코호트/LTV' 를 누르면 정확히 대칭으로 작동한다.

- 저장 시 `domain`(글의 `terms` 에서) + 내 `job_role` 을 함께 남긴다 (`lib/terms.ts`)
- 같은 단어를 다시 누르면 `hit_count` 증가 (`data/userWords.ts`)
- 뜻풀이 2단: 1단(한 줄) → **"더 쉽게"** 버튼 → 내 직무 언어 + 비유로 다시 씀
- 마이 화면 `WeakDomains` — "자주 막히는 영역" 막대

---

## ⑦ 난이도 배지 · 직군 배지

### 난이도 배지 UX 라이팅 (규칙)
- **사람을 등급 매기지 않는다.** "개발자용" 은 비개발자를 밀어낸다 → "코드까지 들어가요"
- **빨강을 쓰지 않는다.** 빨강은 경고라 "깊은 글 = 나쁜 글"로 읽힌다
- 거르는 장치가 아니라 **기대치를 맞추는 장치** (대기업 검증 사례를 보여준다는 방향과 안 부딪히게)

| | 라벨 |
|---|---|
| 🟢 `easy` | 술술 읽혀요 |
| 🟡 `terms` | 용어 몇 개만 |
| 🔵 `code` | 코드까지 들어가요 |

### 직군 배지
`ReaderRoles` — "기획자 12명이 이 글을 읽었어요". **내 직무를 맨 앞으로** 정렬한다.
들어와서 개발자만 보이면 비개발자는 그 자리에서 나가기 때문이다.

---

## ⑧ 연속 읽기 + 레퍼런스 내보내기

### 연속 배지 — **0 을 절대 보여주지 않는다**
0 을 노출하는 순간 벌칙이 되고 "이번 주는 글렀다"가 된다.
연속이 끊기면 **불꽃만 조용히 사라지고** 누적(이번 달 N일)은 남는다.
- `components/distill/ReadingStatsBadge.tsx` — `StreakPill`(홈) / `ReadingStatsRow`(마이)

### 레퍼런스 문서 내보내기
마이 > 캘린더 > 그날 활동 화면에서 **복사**(노션 붙여넣기용 마크다운) / **공유**.
- `lib/exportRef.ts` (순수, 테스트 있음) + `DayActivityScreen`

---

## ⑨ 홈 "이번 주 같이 읽고 있어요"

주 1회 지정글을 **정하지 않는다**(운영 부담 + 아무도 안 읽으면 섹션이 죽는다).
최근 7일 안에 인사이트가 많이 붙은 글을 묶어 "같이 읽는 중"이라는 사실을 보여준다.
- `data/articles.ts` — `listWeeklyTogether` (opinion_count 없으면 like_count → 최신순 폴백)

---

## ⑩ 본문 가독성 (장문 조판)

`theme/distill.ts` 의 `reading` 토큰으로 분리했다(카드용 `dtype` 과 다른 스케일).

| | 이전 | 지금 | 이유 |
|---|---|---|---|
| 본문 | 15.5 / 27 | **17 / 30** | 15.5는 카드용. 장문은 17이 표준 |
| 소제목 | 17 / 25 | **19 / 28** (위 여백 28) | 본문과 1.5px 차이라 구분이 안 됐음 |
| 문단 간격 | 14 | **20** | 덩어리가 안 나뉘어 벽처럼 보임 |
| 좌우 여백 | 16 | **20** | 17px + 20여백 = 한 줄 19~20자(한글 최적 18~24자) |
| 자간 | 없음 | **-0.3** | |

`가/가` 폰트 크기 토글은 기준값에 곱해서 적용 — 사용자 설정과 충돌하지 않는다.

---

## ⑪ 이미지 수집 수정 + 백필 (2026-09-02)

카드 썸네일과 본문 이미지가 비어 있던 문제. **실측으로 진단하고 백필까지 끝냈다.**

| | 작업 전(689건) | 작업 후(779건) |
|---|---|---|
| 대표 이미지 없음 | 202건 (29%) | **0건** |
| 본문 이미지 있는 글 | 278건 (40%) | **756건 (97%)** |

전멸이던 4곳: 올리브영 0→190 · 카카오 0→93 · 강남언니 2→30 · D2 0→10
(당근 재수집 중 신규 글 84건이 함께 수집돼 총계가 689→779로 늘었다.)

### 원인 5가지 (`_shared/extract.ts`)
1. **상대경로 이미지를 통째로 버림** — `/static/…` 이 `^https?://` 검사에서 탈락.
   → `absoluteUrl()` 로 글 URL 기준 해석. og:image 도 동일 처리.
2. **`extractArticle` 이 `base` 를 안 넘김** — 함수는 받는데 내부 `htmlToText` 3곳에
   전달을 빠뜨려 1번 수정이 먹지 않았다.
3. **문단 밀도 경로가 `<p>` 만 수집** — `<figure>`·독립 `<img>` 유실.
4. **이스케이프된 HTML 미처리** — Atom 피드는 본문을 `&lt;img` 로 싣는다.
   태그를 먼저 벗기고 맨 끝에 디코드해서 이미지를 못 잡고 날 HTML 이 본문에 남았다.
   → `looksEscapedHtml()` 이면 선디코드.
5. **경로 선택이 나빴다** — 문단 밀도 경로가 "성공했지만 형편없는" 결과를 내도
   `<article>` 경로에 도달하지 못했다(올리브영 4,228자 vs 10,033자 / NDS 736자 vs 8,573자).
   → 항상 둘 다 계산해 1.5배 이상 길면 `<article>` 채택.

> ⚠️ 시행착오 기록: "첫 문단~마지막 문단 사이 이미지만 채택"이라는 위치 제한을 넣었다가
> **오히려 이미지를 다 죽였다.** Gatsby(올리브영)는 이미지를 문단보다 앞에 렌더하고,
> 워드프레스(NDS)는 본문이 `<p>` 하나뿐이라 범위가 한 점이 된다.
> 껍데기 이미지는 `IMG_CHROME_RE`(로고·아이콘·아바타)로 거른다. 위치로 자르지 말 것.

### 백필 수단 (`collect`)
추출기를 고쳐도 **기존 글은 저절로 안 고쳐진다.** 글은 수집 시점에 한 번 처리되고 끝이다.

| 모드 | 호출 | 언제 쓰나 |
|---|---|---|
| `refresh` | `{blog, refresh:true, since:"2000-01-01", offset}` | 피드/사이트맵에 **아직 남아 있는** 글 갱신 |
| `refetch` | `{blog, refetch:true, limit, offset}` | **DB 의 글을 URL 로 직접** 재수집(과거 글) |

- RSS 는 보통 최근 10~20건만 실어서 `refresh` 로는 과거 글에 손이 안 닿는다.
  올리브영 190건은 `refetch` 로 해결했다.
- Medium(당근)은 페이지가 봇 차단이라 **`refresh`(피드 경로)로만** 된다.
- 둘 다 빈 값은 덮어쓰지 않고, 조회수·좋아요·enrich 결과(`level`/`decision`/`terms`)는 보존한다.
- `offset` 없이 `refresh` 를 반복하면 **같은 앞부분만 반복**된다(기존 글을 안 거르므로).

### 남은 23건은 버그가 아니다
- 네이버 D2 14건 — 실제 페이지에 `<img>` 0개(코드·텍스트만 있는 글)
- 카카오 6건 — Nuxt 페이로드 본문(14,634자 등)에 `<img>`·`<figure>` 0개
- 당근 3건 — Medium 봇 차단. 피드 경로로 114건 중 111건 처리 완료

---

## 남은 일 (다음 세션)

### 1. 실기기 확인 — **아직 아무것도 눈으로 못 봤다**
코드는 게이트를 통과했지만 Expo Go 로 화면을 띄워본 적이 없다.
```
npx expo start
```
- 구글 로그인 화면이 먼저 뜨는지
- 온보딩 1화면(직무 선택)이 뜨고 저장되는지
- 본문 17px + Pretendard 가 실제로 읽히는지(**특히 안드로이드**)
- 스탬프·결정 카드·직군 배지가 그려지는지

### 2. enrich 배치를 아직 안 돌렸다 — **결정 카드/난이도 배지가 비어 있다**
`articles.level` · `decision` · `question` · `terms` 가 전부 null 이라
난이도 배지·결정 카드·질문이 화면에 **하나도 안 나온다**(컴포넌트가 스스로 숨는다).

`supabase/distill_cron.sql` 의 4번 잡을 등록하면 매시 5건씩 채워진다.
급하면 수동으로:
```
POST /functions/v1/summarize  {"article_id":"<uuid>","target":"enrich"}
```

**돌린 뒤 품질 검수가 반드시 필요하다:**
```sql
select title, level, question, decision from public.articles
 where level is not null order by created_at desc limit 50;
```
쓸 만한 질문이 절반도 안 나오면 **질문 기능은 접고 스탬프만 남기는 게 낫다.**
그렇게 접어도 나머지는 그대로 동작하도록 만들어 뒀다.

### 3. B컷 수집 확인
시드는 넣었지만 실제로 글이 들어왔는지 확인 안 했다.
```
POST /functions/v1/collect  {"blog":"bcut"}
```

### 4. 소스 확장 (원래 ①번 목표의 나머지)
B컷 하나만 추가됐다. `blogs.kind` 를 만들어 뒀으니 디자인/마케팅 소스를 더 넣어야
"읽을 게 있다"가 성립한다. 홈 로고 그리드를 `kind` 로 묶는 UI 도 아직 없다.

### 5. 미완 기능
- **스탬프 집계를 큐레이션에 쓰지 않는다** — 💡가 많이 눌린 글을 홈 "바로 써먹은 사례"로
  묶는 섹션이 아직 없다. 스탬프를 모으기만 하고 활용은 안 하는 상태.
- **본문 용어 예고 없음** — `articles.terms` 를 채우게 해뒀지만 글 상단에
  "이 글에 용어 6개 있어요"를 띄우는 UI 가 없다(`lib/terms.ts` 의 `termCount`/`termList` 준비됨).
- **하이라이트 초안의 AI 경로 미구현** — 메모 없이 밑줄만 그은 경우
  (`draft.needsAi === true`) AI 로 core 를 채우는 호출이 아직 없다.
  지금은 사람이 직접 쓴 메모만 재료로 쓴다.

### 6. 카카오페이 등 일부 블로그 이미지 품질
카카오페이는 100%지만 한 글에 65개씩 잡히는 경우가 있다(코드 스크린샷 다수).
과하면 본문이 이미지로 도배되므로 실기기에서 눈으로 볼 것.

---

## 신규 테스트
`src/lib/__tests__/` — `decision.test.ts` · `insightDraft.test.ts` · `exportRef.test.ts`
· `terms.test.ts` · `articleExtract.test.ts`(og:image 절대경로 5건 추가)
