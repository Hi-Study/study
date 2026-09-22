# distill v3 — 테크 블로그를 비개발자가 읽을 수 있게 만든다

> 이 문서는 **작업 이력**이다. 서비스에 무슨 기능이 있고 무엇은 안 하는지는
> **`PRODUCT.md` 가 정본**이다 — 기능을 더하거나 뺄 때는 거기부터 고친다.
>
> 프로젝트: `miran/study-app` (Expo SDK 54 + Supabase).
>
> **검증 상태**: `npx tsc --noEmit` 0 오류 · `npx jest` **187개** 통과(신규 17개) ·
> `npx expo export --platform web` 성공.
> (200 → 187: 범위 축소로 스터디 테스트 4개 파일이 함께 삭제됐다 — ⑥ 참고.)
> 엣지 함수는 tsconfig 에서 제외되므로 따로 검사한다:
> ```
> npx tsc --noEmit --skipLibCheck --target es2022 --module esnext \
>   --moduleResolution bundler --allowImportingTsExtensions supabase/functions/**/*.ts
> ```
> (`Cannot find name 'Deno'` · 원격 import 오류는 정상 — 그 외가 0이어야 한다.)

---

## 왜 이 작업을 했나

v2 는 "읽을 게 있다 / 읽을 수 있다 / 남기기 쉽다"를 만들었다. 그런데 **글 상세가 여전히
개발자가 쓴 순서 그대로**였다. 쉽게 만드는 일은 맨 위 AI 요약에서만 하고, 그 아래 본문은
배경 → 기존 구조 → 기술 검토 → 구현 상세 → 결과 순서로 흘렀다.
결과는 둘 중 하나였다. 요약만 읽고 나가거나, 본문에 들어갔다가 코드에서 막히거나.

비개발자가 테크 블로그에서 막히는 지점은 네 가지다.

| # | 막히는 지점 | v3 의 답 |
|---|---|---|
| ① | 모르는 전제가 설명 없이 나온다 | **이 글을 읽기 전에** (소개 + 알아두면 편해요) |
| ② | 지금 어디쯤인지, 뭐가 중요한지 모른다 | **이 글의 흐름** (단계 + 중요도) |
| ③ | 기술 상세에서 건너뛰어도 되는지 모른다 | 개발자용 단계는 **접어둔다** |
| ④ | 다 읽어도 뭐가 남는지 모른다 | **읽고 나서** (남는 것) |

---

## 핵심 결정 — 재배치가 아니라 덧붙이기

처음 검토한 안은 본문을 **상황 / 판단 / 결과** 세 칸으로 재배치하는 것이었다. 버렸다.

- 그 틀은 *"이 글에서 뭘 뽑아갈까"* 라는 분석 틀이지, *"이 글을 어떻게 따라 읽을까"* 라는
  이해 틀이 아니다.
- 글쓴이가 A→B→C 로 쓴 데는 이유가 있다. 앞을 알아야 뒤가 이해된다. 흩으면 더 안 읽힌다.
- 무엇보다 **AI 가 틀렸을 때 잃는 게 다르다.** 재배치가 틀리면 글이 뒤죽박죽이 되지만,
  덧붙이기가 틀리면 잃는 건 제목 한 줄뿐이고 원문은 그대로다.

그래서 v3 의 규칙은 한 줄이다. **원문 순서를 바꾸지 않는다. 얹기만 한다.**

이건 v2 에서 결정 카드를 화면에서 뺀 것과 같은 교훈이다 — 데이터가 비면 껍데기가 되는
구조는 쓰지 않는다.

### AI 에게 시키는 일도 바꿨다

| | 전 | 후 |
|---|---|---|
| 지시 | "요약해 줘" | "이야기가 바뀌는 **블록 번호**를 줘" |
| 받는 것 | 새로 쓴 문장 | 경계 번호 + 제목 + 한 줄 |
| 검증 | 불가능 (원문에 없는 문장) | 번호 대조 · 용어 글자 대조로 가능 |

단계는 **시작 번호만** 저장한다. 끝 번호는 저장하지 않는다 — 다음 단계의 직전이 곧 끝이라,
구간이 겹치거나 비는 일이 **구조적으로 불가능**하다. 본문 전체가 자동으로 덮인다.

---

## 대분류 분류법 — 무엇을 어떤 축으로 나누나

이 서비스에는 축이 다른 분류가 넷 있다. 섞으면 카드에 색과 칩이 넘쳐나므로 **한 카드에
색 있는 요소는 하나**(주제칩)만 둔다.

| 축 | 값 | 누가 정하나 | 어디에 쓰나 |
|---|---|---|---|
| **주제** (topic) | 개발·프로덕트·디자인·기획·데이터/AI·인프라·커리어·마케팅 (8) | 수집 시 자동 | 피드 필터 · 카드 칩(색) |
| **난이도** (level) | easy / terms / code | enrich 배치 | 상세 배지 · 피드 필터 (색 없음) |
| **단계 중요도** (weight) | **핵심 / 참고 / 개발자용** ← v3 신규 | 가이드 배치 | 글 상세에서 펼침 여부 |
| **아카이브** (archive) | 사용자가 만든 이름 + 아이콘 | **사람** | 보관함 분류 |

### 왜 "중요도"가 새 축인가

이 서비스의 기존 분류는 전부 **글 단위**였다(이 글은 무슨 주제인가, 얼마나 어려운가).
그런데 비개발자가 멈추는 건 글이 아니라 **글 안의 특정 문단**이다. 코드 설명에 부딪히면
"건너뛰어도 되나?"를 몰라서 멈춘다. 그 답을 미리 주는 게 중요도다.

| 값 | 뜻 | 기본 상태 |
|---|---|---|
| `core` 핵심 | 이것만 읽어도 글이 이해된다 | **펼침** |
| `ref` 참고 | 읽으면 좋지만 건너뛰어도 된다 | 접힘 |
| `dev` 개발자용 | 코드·설정값 | 접힘 |

그대로 스크롤하면 핵심만 이어서 읽힌다 — 그게 3분 읽기다. 접힌 단계도 **제목과 한 줄
안내는 보이므로**, 건너뛰어도 무슨 얘긴지는 알고 넘어간다.

### 아카이브는 왜 북마크와 따로인가

- **북마크 = 저장.** 한 번 누르면 끝. 고민이 없어야 한다.
- **아카이브 = 분류.** 나중에 찾기 위해 묶는다.

합치면 저장이 무거워진다(담을 때마다 폴더를 골라야 한다). 대신 **아카이브에 담으면
북마크에도 자동으로 들어간다**(반대는 아니다) — 담아둔 글이 "내 저장글"에 없으면 숫자가
어긋나 보인다.

---

## ⓪ 먼저 할 일 (사람이 해야 하는 것)

### 0-1. SQL 실행 — ⚠️ 미실행

`supabase/distill_schema.sql` 의 **섹션 33~34** 를 Supabase SQL Editor 에서 실행한다.
재실행 안전(idempotent)이라 파일 전체를 붙여넣어도 된다.

| 섹션 | 내용 |
|---|---|
| 33 | `articles.reading_guide jsonb` — 읽기 가이드 |
| 34 | `archives` · `archive_articles` + RLS + RPC `my_archive_counts` · `my_read_rate` |

**실행 전까지의 동작**: 아카이브 탭은 "모든 저장글" 타일과 추가 버튼만 보이고(목록 조회 실패를
빈 목록으로 떨어뜨린다), 글 상세는 가이드 없이 **v2 모습 그대로**(AI 요약 + 본문 통짜) 뜬다.
화면이 깨지지는 않는다.

### 0-2. 엣지 함수 재배포 — ⚠️ 미배포

```
supabase functions deploy summarize
```

`target: "guide"` 분기와 `_shared/blocks.ts` 가 새로 들어갔다.

### 0-3. 기존 글에 가이드 채우기 (선택)

글을 열 때 없으면 그 자리에서 한 번 만든다(상세 화면이 자동 요청). 미리 채우려면
`supabase/distill_cron.sql` 의 enrich 잡과 같은 방식으로 `target:"guide"` 를 돌리면 된다.

---

## ① 읽기 가이드 (§33)

### 저장 모양 — `articles.reading_guide jsonb`

```json
{
  "intro": "주문 목록이 느려진 걸 데이터를 나눠 담아 고친 이야기예요.",
  "terms": [{ "term": "파티셔닝", "plain": "큰 데이터를 기간별로 나눠 보관하는 것" }],
  "steps": [
    { "start": 0,  "title": "어쩌다 느려졌나", "say": "…", "weight": "core" },
    { "start": 5,  "title": "검토한 방법들",   "say": "…", "weight": "ref" },
    { "start": 12, "title": "설정값과 코드",   "say": "…", "weight": "dev" }
  ],
  "takeaways": ["실시간성이 걸리면 캐시는 답이 아니다"]
}
```

`start` 는 **블록(문단) 번호**다. 앱의 `groupSentencesIntoBlocks` 순번과 같아야 하고,
엣지 쪽 사본은 `supabase/functions/_shared/blocks.ts` 다.
⚠️ **두 파일은 규칙이 같아야 한다.** 갈라지면 엉뚱한 문단에 제목이 붙는다.

### 게이트 — 사람 검토 없이 굴러가게 (`gateGuide`)

통과 못 하면 **저장하지 않는다**. 화면은 v2 모습으로 뜬다.

| # | 검사 | 왜 |
|---|---|---|
| 1 | 단계 2개 이상 (긴 글은 3개 이상) | 1개면 본문이 통짜라 흐름이 없다 |
| 2 | 모든 `start` < 블록 수 | 다른 글을 보고 답한 것 |
| 3 | `start` 오름차순·중복 없음 | 순서를 못 지켰으면 제목도 못 믿는다 |
| 4 | 첫 단계 `start === 0` | 앞머리 문단이 사라지면 안 된다 |
| 5 | 한 단계가 본문 80% 미만 | 나머지가 들러리면 나눈 의미가 없다 |
| 6 | 중요도가 전부 같지 않음 | 전부 core 면 고른 게 아니다 |
| 7 | 용어가 **본문에 글자 그대로 있음** | 지어낸 용어 차단 |

### 클라이언트 방어 — `src/lib/guide.ts`

DB 에서 온 jsonb 는 무엇이든 올 수 있다고 보고 전부 여기서 정규화한다(화면은 정규화된 값만
만진다). `guideSections()` 의 계약은 한 줄이다 — **구간을 이어 붙이면 언제나
`[0, blockCount-1]`**. 테스트 17개가 이걸 지킨다(`src/lib/__tests__/guide.test.ts`).

---

## ② 글 상세 화면

```
[읽기 전]
 히어로 · 주제칩 · 난이도 · 공유/아카이브/북마크
 제목 · 개선 한 줄(+수치) · 태그 · 출처·작성일
 [ 원문 보기 ]  [ 핵심만 볼래요 ]
 ┌ 이 글을 읽기 전에 ─────────────┐
 │ 2~3문장 + 알아두면 편해요 (≤3)  │
 └────────────────────────────────┘
[흐름 = 본문]            전체 펼치기
 ① 어쩌다 느려졌나          [핵심]  ▲  ← 펼쳐진 채로 시작
    여기서 하는 말 …
    (원문 그대로 · 밑줄 · 용어)
 ② 검토한 방법들            [참고]  ▼  ← 제목+한 줄은 보인다
 ③ 설정값과 코드        [개발자용]  ▼
[읽고 나서]
 이 글에서 남는 것 · 생각해볼 질문 · 스탬프 · 직군 배지
[하단 고정]  내 생각도 남겨볼까요?
```

### 바뀐 것

| | v2 | v3 |
|---|---|---|
| 본문 | 통째로 한 덩어리 | 단계별 아코디언(원문 순서 그대로) |
| AI 요약 | 상단 **자동 생성**(안 볼 사람 몫까지 토큰 소모) | `핵심만 볼래요` 를 눌러야 생성 |
| 원문 | `Linking.openURL` → **앱 밖 브라우저** | `ArticleWebView` → **앱 안 웹뷰** |
| 읽기시간 | 표시 | **제거** (사람마다 다르고 "오래 걸리는 글"로 읽힌다) |
| 직군 배지 | 제목 바로 아래 | 맨 아래 (이해에 도움이 안 된다) |
| 탭 | 원문 / 인사이트 | 글 읽기 / 인사이트 |

### 원문 보기는 왜 웹뷰인가

아이프레임은 앱에서 동작하지 않고, 웹에서도 많은 블로그가 프레임 삽입을 막는다(`X-Frame-Options`).
웹뷰는 브라우저처럼 페이지를 직접 여는 것이라 그 제약을 받지 않는다.
웹 빌드에서는 iframe 으로 그리고, 막힌 사이트를 위해 "브라우저로 열기"를 같이 둔다.

밑줄·용어 풀이는 웹뷰에서 안 된다(남의 페이지라 손댈 수 없다). 그건 흐름이 맡는다 —
둘은 대체가 아니라 **역할 분담**이다.

---

## ③ 아카이브 (§34)

```
[아카이브 탭]                      [만들기 1/2]        [만들기 2/2]
 로고 · 검색 · 설정                아카이브 제목을      아카이브 아이콘을
 ┌ 밀린 글을 확인해 보세요 ┐        입력하세요.          선택하세요.
 완독률 48/62 ████░ 78%            [        ] 6/15      ○ ○ ○
 내 아카이브            수정                            ○ ● ○
 ┌모든 저장글┐┌지구 지키기┐         [   다음   ]         [   완료   ]
 │ 62개  ALL││ 4개     🌱│
 └──────────┘└──────────┘
```

- **완독률의 분모는 저장한 글**이다. 전체 글을 분모로 잡으면 영원히 0% 라 아무 동기도 안 된다.
- 첫 타일은 항상 **모든 저장글**(북마크 전체) — 보관함을 만들어야만 쓸 수 있는 기능이 되지 않게.
- 만들기를 두 걸음으로 나눈 이유: 한 화면에 두면 아이콘을 건너뛰는데, **아이콘이 없으면
  그리드에서 타일이 다 비슷해 보여 나중에 못 찾는다.**
- 아카이브 상세의 필터는 셋뿐 — 찾기 · 읽음 여부 · 카드 크기. 주제·난이도는 피드가 한다.
  보관함에서 막히는 건 대개 "읽었나 안 읽었나"다.
- 카드 크기는 연속 슬라이더가 아니라 **눈금 3칸**(리스트/그리드/큰 카드). 연속이면 같은
  화면을 두 번 만들 수 없다("아까 그 크기"로 못 돌아온다).

---

## ④ 그 밖의 화면

| 화면 | 바뀐 것 |
|---|---|
| 홈 | 밀린 글 배너를 맨 위로(검색바보다 위). **완독률·내 아카이브 칩은 홈에서 뺐다** — 아카이브 탭이 정본 |
| 피드 | **안 읽은 글만** 토글. 서버 필터가 아니라 받아온 목록에서 거른다(공용 쿼리 캐시가 갈라지면 페이지네이션이 어긋난다) |
| 마이 | 달력을 프로필 바로 아래로 올림(카드형 · 제목 + 접기/펼치기). 내 아카이브·관심 기업은 테두리 하나의 메뉴 카드 |
| 하단 탭 | 5개 → **4개** (홈 · 피드 · **아카이브** · 마이) |

아카이브를 탭으로 올린 이유: 저장은 쉬운데 **다시 찾는 길이 마이 안쪽에만** 있었다.
담아두고 안 읽는 게 이 서비스의 가장 큰 누수라, 돌아오는 문을 제일 가깝게 뒀다.
인사이트 탭을 뺀 이유와 나머지 재배치는 **⑥** 에 모았다.

---

## ⑤ 디자인 — 강조색 전환

인디고(`#4F46E5`) → **바이올렛(`#7C3AED`)**. 인디고는 파랑에 가까워서 카드가 많이 깔린
화면에서 회색 UI 와 섞여 보였다. 바이올렛은 같은 채도에서도 흰 카드 위에서 떠오르고,
배너·칩·아이콘 타일까지 한 색으로 끌고 갈 수 있다.

정본은 `src/theme/colors.ts` 이고, 문서는 `DESIGN_SYSTEM.md`(구현 계약) ·
`DESIGN_GUIDE.md`(근거)다. ⚠️ 하드코딩 hex 금지 — 전부 토큰으로.

---

## ⑥ 범위 축소 — 무엇을 왜 걷어냈나

서비스를 **목록 · 상세 · 인사이트 · 마이** 넷으로 좁혔다. 이유는 하나다 —
담아두고 안 읽는 게 이 서비스의 가장 큰 누수인데, **기능이 넓으면 어느 것도 안 쓴다.**
읽는 길 하나를 끝까지 좁게 파기로 했다.

| 걷어낸 것 | 사라진 것 | 왜 뺐나 |
|---|---|---|
| **알림 전체** | `DistillNotificationsScreen` · 홈·아카이브의 벨 아이콘 · 안 읽은 개수 · `data/appNotifications.ts` | 알릴 만한 사건이 죄다 남의 활동이었다. 그 활동을 보는 화면을 없애니 알림이 가리킬 곳도 없어졌다 |
| **커뮤니티 자유글** | `CreateCommunityPostScreen` · `CommunityPostDetailScreen` · `CommunityCard` · `data/community.ts` · 홈의 커뮤니티 섹션 · 마이/날짜별 활동의 커뮤니티 분기 | 글을 읽지 않고도 쓸 수 있는 통로였다. 이 앱에서 남기는 글은 **읽은 글에 붙는 인사이트** 하나면 된다 |
| **인사이트 탭** | `DiscussScreen`(남의 인사이트 피드) · `InsighterProfileScreen` · 팔로우(`data/follows.ts`) · 의견 상세의 작성자 프로필 링크 | 남의 인사이트만 모아 보면 원글을 읽지 않은 채로 소비된다. 인사이트는 **읽은 글에 붙어 있을 때만** 의미가 있다 |
| **스터디 앱 전체(15개 화면)** | `src/screens/study/*` · MyStudies·CreateStudy·JoinStudy·Members·StudyManage·StudyEdit·ActivityList·Notifications · `StudyTabs` · `ShareCard`·`SharesSectionList`·`DiscussionRows` · `data/{studies,shares,discussions,comments,likes,dashboard,notifications}.ts` | distill 이전 서비스의 잔재다. 탭 하나 뒤에 두 번째 앱이 통째로 있었고, 같은 개념(공유·토론·댓글)이 두 벌로 존재했다 |
| **글 직접 등록** | `CreateArticleScreen` · `data/submit.ts` | 유일한 진입점이 인사이트 탭의 FAB 이어서 탭과 함께 고아가 됐다. 글은 수집 배치로만 들어온다 |

함께 지운 테스트는 `src/data/__tests__/{studies,shares,discussions,comments}.test.ts` 4개 파일이다.
그래서 테스트 수가 200 → **187개**가 됐다.

### 남은 넷은 이렇게 재배치했다

| 탭 | 지금 순서 |
|---|---|
| 홈 | 워드마크+검색·설정 → 보라 배너("밀린 글을 확인해 보세요") → 검색바 → 추천 캐러셀 → 이번 주 같이 읽는 글 → 서비스별 → 인기 → 주제 태그 → 이어읽기 |
| 피드 | `[피드 🔍]` → 필터 칩 한 줄(`FilterSheet variant="chips"`) → `[N개 · 안 읽은 글만]` → 리스트 |
| 아카이브 | 워드마크+검색·설정 → 밀린 글 배너 → 완독률 카드 → 아카이브 타일 그리드 2열 |
| 마이 | 워드마크+검색·설정 → 프로필 카드 → **달력** → 이번 달 수치 → 메뉴 카드(내 아카이브 · 관심 기업) → 자주 막히는 영역 → 내 활동 세그먼트 |

- **완독률을 홈에서 뺐다.** 아카이브 탭이 정본이다 — 같은 숫자가 두 탭에 있으면 어디가 정본인지 헷갈린다.
- **피드의 큰 기업 드롭다운 히어로를 버렸다.** 머리가 화면 위쪽 절반을 먹어서 작은 폰에선 글이
  두세 줄밖에 안 보였다. 목록 화면의 일은 글을 많이 보여주는 것이다.
- **마이의 달력을 위로 올렸다.** 들어오자마자 이번 달이 보여야 달력을 둔 의미가 있다.
- 인사이트 남기기·읽기는 **글 상세 안에서만** 한다(`CreateOpinionScreen` · `OpinionDetailScreen` 은 남아 있다).

### ⚠️ DB 스키마는 건드리지 않았다

`community_posts` · `app_notifications` · `user_follows` · `studies` · `shares` · `discussions` ·
`comments` 테이블과 그 안의 데이터는 **그대로 남아 있다.** 앱에서 안 쓸 뿐이고,
마이그레이션·RLS 도 손대지 않았다. **되돌리기 쉽게 하려고 일부러 그렇게 뒀다** —
화면을 다시 붙이면 데이터가 그대로 살아난다.

---

## 파일 지도

```
신규
  src/lib/guide.ts                              가이드 정규화 + 구간 계산 (+테스트 17개)
  src/components/distill/ReadingIntro.tsx       이 글을 읽기 전에
  src/components/distill/ReadingFlow.tsx        이 글의 흐름(=본문)
  src/components/distill/ArchivePickerSheet.tsx 아카이브 담기
  src/components/distill/SizeSlider.tsx         카드 크기 3단
  src/screens/distill/ArticleWebViewScreen.tsx  원문 웹뷰
  src/screens/distill/ArchiveHomeScreen.tsx     아카이브 탭
  src/screens/distill/ArchiveDetailScreen.tsx   아카이브 상세
  src/screens/distill/CreateArchiveScreen.tsx   만들기 2단계
  src/data/archives.ts                          아카이브 데이터 계층
  supabase/functions/_shared/blocks.ts          ⚠️ src/lib/text.ts 의 사본

수정
  src/screens/distill/ArticleDetailScreen.tsx   전면 개편
  src/components/distill/ArticleHighlightSection.tsx  range 옵션(구간만 그리기)
  src/components/distill/ActivityCalendar.tsx   카드형 + 접기
  src/theme/colors.ts                           바이올렛 전환
  src/theme/distill.ts                          ARCHIVE_ICONS · STEP_WEIGHT_META
  supabase/functions/summarize/index.ts         target:"guide" + 게이트
  supabase/distill_schema.sql                   §33 · §34

삭제  (⑥ 범위 축소 — DB 는 그대로 두고 앱에서만 뺐다)
  src/screens/study/*                           스터디 앱 화면 7개
  src/screens/{MyStudies,CreateStudy,JoinStudy,Members,StudyManage,StudyEdit,ActivityList,Notifications}Screen.tsx
  src/navigation/StudyTabs.tsx                  스터디 하단 탭
  src/components/{ShareCard,SharesSectionList,DiscussionRows}.tsx
  src/screens/distill/DistillNotificationsScreen.tsx   알림
  src/screens/distill/CreateCommunityPostScreen.tsx    커뮤니티 자유글 쓰기
  src/screens/distill/CommunityPostDetailScreen.tsx    커뮤니티 자유글 상세
  src/components/distill/CommunityCard.tsx
  src/screens/distill/DiscussScreen.tsx                인사이트 탭(남의 인사이트 피드)
  src/screens/distill/InsighterProfileScreen.tsx       인사이터 프로필
  src/screens/distill/CreateArticleScreen.tsx          글 직접 등록
  src/data/appNotifications.ts · community.ts · follows.ts · submit.ts
  src/data/{studies,shares,discussions,comments,likes,dashboard,notifications}.ts
  src/lib/notifPrefs.ts
  src/data/__tests__/{studies,shares,discussions,comments}.test.ts   (200 → 187개)
```
