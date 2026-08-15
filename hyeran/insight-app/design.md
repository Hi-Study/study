# 인사이트 — Design System

> 기업 기술블로그 글을 읽고 나의 인사이트를 나누는 **모바일 우선** 한국어 서비스.
> MiniMax 시각 언어를 모바일 리더 앱 맥락에 이식한 결과물이다.
> 구현: `src/app/globals.css`(토큰·컴포넌트 클래스), `src/components/*`(마크업).

## Overview

인사이트는 **스타크 모노크롬(화이트 캔버스 + 검정 잉크)** 위에 **코랄 한 색**만 아껴 쓰는 절제된 언어를 쓴다. 검정(`{colors.primary}` = `#000`/`{colors.ink}`)이 대표 CTA이고, 코랄(`{colors.cat-ai-fg}` = `#FF4A28`)은 "지금 주목" 순간 — 뱃지, FAB, 히어로 글로우, 활성 즐겨찾기 — 에만 등장한다. 파랑(`{colors.blue-info}`)은 링크/정보 보조로 강등된다.

**피드가 기준 화면**이다. 목록은 **이미지 중심 카드**(커버 + 날짜 뱃지 + 기업 브랜드 뱃지 + 제목)로 구성하고, 다른 모든 화면이 이 카드 언어·색·타이포를 따른다. 이미지가 없는 글은 **기업 브랜드색 그라디언트 플레이스홀더**로 채워 카드 리듬을 유지한다.

홈은 **네 개 큐레이션 섹션**으로 위계를 만든다(위→아래): ① **오늘의 글** — 최근 7일 인기 1위 한 장을 **다크 히어로 카드**(브랜드 다크 + 코랄 글로우)로, ② **인기 글** — 인사이트 많은 상위 10개를 **2열 그리드**로, ③ **북마크 글** — 내가 저장한 글을 **가로 스와이프(+전체보기)**로, ④ **기업별 글** — 기업별 최신을 **가로 스와이프(+전체보기)**로. 섹션 사이는 **8px surface 구분선**으로 크게 나눈다.

서체는 **Pretendard 단일 서체**를 모든 역할에 쓴다. 디스플레이·본문·라벨·**뱃지·아이콘 옆 메타 문구**까지 전부 Pretendard 하나로 통일한다(별도 라틴/모노 서체 없음).

**Key Characteristics**
- 모노크롬(화이트 `{colors.canvas}` + 검정 `{colors.primary}`)에 코랄 `{colors.cat-ai-fg}` 단일 포인트
- 검정 알약 = 대표 CTA. 브랜드색은 정체성 순간에만
- **피드(기준 화면)**: 이미지 중심 카드 — 커버 + 날짜 뱃지 + 기업 브랜드 뱃지 + 제목
- 홈 4섹션: 오늘의 글(다크 히어로 1장) → 인기 글(2열 그리드) → 북마크(스와이프+전체보기) → 기업별(스와이프+전체보기)
- **통일 카드 메타** (커버 카드·리스트 로우 2변형): 이미지·북마크·제목·작성자/출처·읽음 수·인사이트 수·등록일 — 밀도만 다르고 메타·토큰은 동일. 검색·마이는 리스트형(썸네일)
- **혼용 라벨**: 로고·카테고리는 영문(INSIGHT. / Product·Design·Tech·AI), 탭·본문은 한글
- 실제 기업 로고(인라인 SVG 마크)
- **Pretendard 단일 서체** — 모든 텍스트(뱃지·메타 포함)
- 480px 모바일 셸 + 상단 알림 벨 + 하단 탭바(홈/피드/인사이트/마이) + 우하단 FAB
- 모든 버튼/칩/탭/뱃지 `{rounded.full}`

> **이번 디자인 리프레시에서 그대로 유지(변경 안 함):** 상단 앱바의 **알림 벨**, **하단 탭바**(홈·피드·인사이트·마이), 기존 **검색바 위치**. 레퍼런스의 헤더-내 검색 이동이나 Feed/Explore/Saved/Settings 하단 네비게이션은 채택하지 않는다.

## Colors

### Brand & Accent
- **Coral** (`{colors.cat-ai-fg}` = `#FF4A28`): 유일한 브랜드 포인트. NEW 뱃지, FAB, 히어로 글로우, 활성 즐겨찾기. 과용 금지.
- **Blue Info** (`{colors.blue-info}` = `#056DFF`): 링크·정보 보조. 주요 CTA 아님.

### Ink & Surface
- **Primary / Ink** (`{colors.primary}` = `#000000`, `{colors.ink}` = `#161616`): 대표 CTA 배경, 헤드라인.
- **Canvas** (`{colors.canvas}` = `#FFFFFF`): 페이지·카드 기본 배경.
- **Surface** (`{colors.surface}` = `#F4F5F7`): 검색 pill, AI카드·작성자카드, 읽음 뱃지, **섹션 구분선(8px)**.
- **Hairline** (`{colors.hairline}` = `#E9EAEE`): 카드 1px 테두리, 구분선, 앱바 하단선.

### Text
- **Charcoal** (`{colors.charcoal-text}` = `#2A2A2A`): 본문.
- **Steel** (`{colors.steel-text}` = `#6B7280`): 보조·메타·비활성 탭·라벨.
- **Stone** (`{colors.stone-text}` = `#9AA0AB`): 뮤트 캡션.

### Category 아이브로우 (프로덕트/디자인/기술/AI)
카테고리는 파스텔 배경 + 진한 글자 **알약 라벨**로 표시(Pretendard). 필터 칩·라벨은 **영문**(`CAT_EN`: Product/Design/Tech/AI), 본문 제목은 한글(혼용 원칙).
- **기술** — bg `{colors.cat-tech-bg}` `#EEF4FF` / fg `{colors.cat-tech-fg}` `#2563EB`
- **디자인** — bg `{colors.cat-design-bg}` `#F3EDFF` / fg `{colors.cat-design-fg}` `#7C3AED`
- **프로덕트** — bg `{colors.cat-product-bg}` `#E6F6F2` / fg `{colors.cat-product-fg}` `#0D9488`
- **AI** — bg `{colors.cat-ai-bg}` `#FFF0EC` / fg `{colors.cat-ai-fg}` `#FF4A28`

### Semantic
- **Success** — bg `{colors.success-bg}` `#E7F6EC` / text `{colors.success-text}` `#127A3E` (읽음 등)
- **Read (중립)** — bg `{colors.surface}` / text `{colors.steel-text}`

### Dark Mode
`prefers-color-scheme:dark`에서 배경·카드·잉크 반전. 검정 CTA는 화이트 알약으로 반전. 코랄·검정 대비는 다크에서도 유지. 정식 다크 팔레트는 추후.

## Typography

### Font Family — **Pretendard 단일 서체**
모든 역할(디스플레이·히어로·앱바 로고·본문·라벨·카드 제목·기업명·**아이브로우/뱃지**·버튼·**메타(아이콘 옆 문구)**)을 **Pretendard** 하나로 처리한다.

```
"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif
```

> DM Sans, JetBrains Mono는 **사용하지 않는다**(사용자 결정). 레퍼런스가 hero/appbar에 DM Sans, eyebrow/meta에 JetBrains Mono를 지정했더라도 전부 Pretendard로 통일한다. 숫자 정렬이 필요한 곳(수치 메타)은 `font-variant-numeric: tabular-nums`로 보정한다. 기업 로고 SVG 내부 워드마크는 브랜드 자산이므로 예외.

### Hierarchy (전부 Pretendard)

| Token | Size | Weight | Line H | Letter Sp | Use |
|---|---|---|---|---|---|
| `{typography.appbar}` | 21px | 600 | 1.30 | -0.5px | 앱바 로고·타이틀 |
| `{typography.display-title}` | 20px | 600 | 1.30 | -0.5px | 상세 제목, 기업 헤더명 |
| `{typography.hero}` | 19px | 600 | 1.20 | -0.4px | 히어로/강조 타이틀 |
| `{typography.card-title}` | 15px | 600 | 1.40 | -0.3px | 카드 제목 |
| `{typography.company-name}` | 15px | 600 | 1.30 | 0 | 기업명 |
| `{typography.body}` | 15px | 400 | 1.72 | 0 | 원문 본문 |
| `{typography.body-sm}` | 13.5px | 400 | 1.60 | 0 | AI 답변, 입력값 |
| `{typography.label}` | 12px | 600 | 1.40 | 0 | 폼 라벨, 섹션 타이틀 |
| `{typography.button}` | 14px | 600 | 1.40 | 0 | 버튼·칩 라벨 |
| `{typography.eyebrow}` | 10px | 600 | 1.00 | 0.1em | 카테고리 아이브로우·뱃지 (Pretendard, UPPERCASE 느낌은 자간으로) |
| `{typography.meta}` | 11px | 400 | 1.40 | 0 | 메타·수치·도메인 (아이콘 옆 문구, Pretendard) |

### Principles
- **단일 서체**: Pretendard 하나로 전 역할. 위계는 크기·무게(400/500/600/700)·색으로만.
- 이탤릭 없음. 강조는 weight.
- 숫자 정렬 구간은 `tabular-nums`.
- 본문 line-height 1.72로 한글 장문 가독 확보.

## Layout

- **셸**: `{spacing.max-width}` 480px 중앙 정렬. 상단 앱바 + 하단 탭바 + 우하단 FAB.
- **Spacing**: base `{spacing.base}` 4px. 페이지 좌우 `{spacing.page-margin}` 15px. 섹션 간 `{spacing.section-gap}` 22px. 카드 패딩 `{spacing.card-p}` 14px.
- **섹션 구분**: 추천 ↔ 기술 블로그 사이는 **8px 두께 surface 구분선**(full-bleed)로 크게 나눈다.
- **홈 구조**: 앱바(로고·알림) → 검색 pill → **오늘의 글**(히어로 1장) → 8px 구분선 → **인기 글**(2열 그리드) → 8px 구분선 → **북마크 글**(스와이프+전체보기) → 8px 구분선 → **기업별 글**(스와이프+전체보기).

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.lg}` | 8px | 입력, 소형 로고 타일 |
| `{rounded.xl}` | 12px | 보조 |
| `{rounded.2xl}` | 16px | 카드(추천·목록), AI/작성자 카드 |
| `{rounded.hero}` | 22px | 히어로/강조 패널 |
| `{rounded.full}` | 9999px | 버튼·칩·탭·뱃지·검색 pill·FAB·아바타 |

## Elevation

flat + 하드라인 기본. 떠 있는 요소에만 그림자.
- flat: 카드·입력·뱃지 — `{colors.hairline}` 테두리, 그림자 0.
- FAB: 코랄 + `0 6px 18px rgba(255,74,40,.42)`.
- 히어로: 그림자 대신 내부 코랄 방사 글로우.
- 모달·드로어: `0 12px 40px rgba(0,0,0,.28)`.

## Components

### Buttons — 전부 알약
- **`button-primary`**: 검정 알약. bg `{colors.ink}`, text `{colors.on-primary}`, `{rounded.full}`. 비활성 bg `{colors.surface}`.
- **`button-outline`**: bg `{colors.canvas}`, `1px solid {colors.ink}`, `{rounded.full}`.
- **`button-google`**: bg `{colors.canvas}`, `1px solid {colors.hairline}`, `{rounded.full}`.
- **`fab`**: 56px 원형. bg `{colors.cat-ai-fg}` 코랄. 우하단 고정, 탭바 위.

### Feed — 기준 화면 (이미지 중심)
서비스의 **기준 화면**. 모든 목록 UI는 이 카드 언어를 따른다.

- **Feed Header** — `INSIGHT.`(대문자, 코랄 점) 워드마크 + 알림 벨, 하단 하드라인. (햄버거 드로어는 추후.)
- **Underline Tabs (`utabs`)** — 전체 / 북마크. 활성 = 검정 텍스트 + 2px 하단바(`{colors.ink}`), 비활성 = 스틸. (알약 seg 아님.)
- **Company Filter Chips (`cchip`)** — 가로 스크롤, 배타 선택.
  - `All` / `팔로우 중`: 아웃라인 알약, 활성 시 검정.
  - 회사 칩: **브랜드색 채움**(`company.color`) + 대비 텍스트 자동(`readableText`). 팔로우한 회사엔 ★. 선택 시 검정 링(`sel`).
- **Category Filter Chips (`katchip`)** — **영문** 아웃라인 알약(Product/Design/Tech/AI), 다중 선택, 활성 = 검정.
- **Feed Card (`fcard`)** — 이미지 중심.
  - 커버(`fcard-cover`, 16:9): 커버 이미지(body 첫 `::img::`). 오버레이 — **북마크 토글**(`fcard-bm`, 우상단) · 기업 뱃지(`fcard-co`, 좌하단, 브랜드색+대비 텍스트) · 읽음(`fcard-read`, 좌상단).
  - 본문(`fcard-body`): 제목 16px/700 2줄 클램프 + **통일 카드 메타**(작성자/출처 · 읽음 수 · 인사이트 수 · 등록일).
  - 카드: `{rounded.2xl}` + 1px 하드라인 + 옅은 그림자.
- **Cover Placeholder (`fcard-cover.ph`)** — 이미지 없는 글: **기업 브랜드색 그라디언트**(밝은→어두운) + 가운데 큰 기업 로고(옅게).

> **통일 카드 메타 (전 화면 공통)**: 이미지 · 북마크 · 제목 · **작성자**(직접 등록)/**출처**(기업) · **읽음 수** · **인사이트 수** · **등록일**. 메타 세트는 전 화면 공통이되, 표현은 **밀도 2변형**으로 나눈다 — **커버 카드**(`fcard`, 16:9 이미지 · 홈·피드)와 **리스트 로우**(`lrow`, 작은 썸네일 목록 · 검색·마이). 두 변형은 **같은 토큰·같은 메타**를 쓰는 한 가족이라, 밀도만 다르고 인상은 하나다.
> **조회수(뷰수)는 별도 추적하지 않는다** — 조회 로그 대신 `reads`(스크롤 90% 완독) 수를 "읽음 수"로 표기해 뷰수 자리를 대체한다. 레퍼런스의 평점(★)·시간제한 카운트다운은 도입하지 않는다.

### 오늘의 글 (`today-hero`) — 홈 최상단
최근 7일 내 글 중 **인기 1위 한 장**만 노출(유저 무관). 인기도 = **읽음 수 + 인사이트 수** 합, 동률 시 최신. **다크 히어로 카드**(브랜드 다크 배경 + 코랄 방사 글로우)로 시선을 끈다. **캐러셀·점 인디케이터 없음**(단일 장).
- 카드(`feature`): bg `{colors.hero-bg}`(다크), text 화이트, `{rounded.hero}`, 우상단 코랄 방사 글로우(`::after`). 구성: 코랄 아이브로우(✦ 오늘의 글) / 히어로 타이틀 / AI 요약 서브라인 / 상단 구분선 후 푸터(작성자·출처 · 읽음 수 · 인사이트 수 · 등록일) / 우상단 원형 열기 버튼.

### 인기 글 (`popular-grid`) — 2열 그리드
**인사이트 많은 상위 10개**를 **2열 그리드**로(세로 스크롤, 캐러셀 아님). 카드는 **통일 카드 메타**를 쓰되 커버 비율을 유지해 잡지형 리듬을 만든다.

### 큐레이션 로우 (`curation-row`) — 북마크 / 기업별 공통
가로 스냅 스와이프 + 섹션 헤더 우측 **전체보기** 버튼. 두 섹션에 재사용한다.
- **북마크 글**: 내가 북마크한 글. 없으면 → 아래 '빈 상태 / 인증 안내'.
- **기업별 글**: 기업 헤더(로고+이름+즐겨찾기) 아래 해당 기업 최신 카드가 흐른다.
- 카드: `{rounded.2xl}`, **통일 카드 메타**, `flex 0 0 76%` peek.

### 리스트 로우 (`lrow`) — 검색·마이 (밀도형)
롱블랙 '지난 노트' 스타일. 세로 목록에서 밀도를 높이는 **통일 카드 메타의 리스트 변형**이다. 커버 카드와 같은 메타·색·타이포를 쓰되 이미지를 작게 줄여 한 화면에 많이 담는다.
- **좌: 썸네일** — 56px 정사각(`{rounded.lg}`). 커버 이미지(첫 `::img::`) 또는 **기업 브랜드색 플레이스홀더 + 로고**(커버 없을 때).
- **우: 제목**(`{typography.card-title}`, 2줄 클램프) + **메타 라인**(작성자/출처 · 읽음 수 · 인사이트 수 · 등록일).
- **우측 끝: 북마크 토글**.
- 행: 카드 면 없이 **플랫 목록**, 사이 `{colors.hairline}` 1px 또는 8px 간격.
- 커버 카드와 **동일 메타·토큰** — 밀도만 다르다(큰 이미지 강요 금지).

### 인사이트 카드 (`review`) — 인사이트 탭 (통일 카드 예외)
인사이트 탭은 "글"이 아니라 **사람들의 감상(리뷰)**을 보여주므로 통일 카드(커버/리스트) 대상이 **아니다**. 단, 같은 토큰을 쓰고 **작은 글 썸네일**을 얹어 리스트 로우와 시각적으로 라임을 맞춘다.
- **좌: 글 썸네일** — 40px 정사각(`{rounded.lg}`). 커버 이미지(첫 `::img::`) 또는 기업색 플레이스홀더.
- **우**: 작성자 아바타+이름 · 작성일 / 글 제목(뮤트, 상세로 링크) / 감상 한 토막(q1~q3 첫 답) / 댓글 수(`CommentSheet`).
- **글 메타 안 붙임**: 북마크·읽음 수·인사이트 수는 여기 두지 않는다 — 감상 피드이지 글 목록이 아니다.
- 탭: 전체 / 북마크(내가 북마크한 글에 달린 인사이트).

### Company Logo (`clogo`)
실제 기업 로고(인라인 SVG 마크: 토스·카카오·네이버·배민·당근·라인). 미매칭 시 컬러 이니셜 타일 폴백. 헤더 38px / 카드 26px / 인라인 20px.

### Company Header (`comprow`)
로고 + **기업명** + **즐겨찾기 별**(이름 옆). 도메인 표기 없음. 활성 별은 코랄.

### AI / Author Card
- **`ai-card`**: AI 3문답. bg `{colors.surface}`, `{rounded.2xl}`. `✦`(코랄) 아이브로우 + Q/A 쌍.
- **`author-card`**: 직접 등록 작성자. bg `{colors.surface}`, `{rounded.2xl}`.

### Chips & Tabs — 알약
- **`chip`**: 비활성 bg `{colors.canvas}` + `1px {colors.hairline}` + `{colors.steel-text}`. 활성 bg `{colors.ink}` + `{colors.on-primary}`.
- **`seg`**: 알약 세그먼트(요약/원문, 전체/북마크, 마이 탭). 활성 검정.
- **`chip-cat`**(아이브로우): 카테고리별 파스텔 bg/fg.

### Badges — 알약 (Pretendard)
- **`badge-new`**: bg `{colors.cat-ai-fg}` 코랄 / `#fff`.
- **`badge-read`**: bg `{colors.surface}` / `{colors.steel-text}`.
- **`badge-ok`**: bg `{colors.success-bg}` / `{colors.success-text}`.

### Section Divider (`section-divider`)
섹션 대분류용 **8px 두께 surface 구분선**(full-bleed). 추천 ↔ 기술 블로그 사이에 사용.

### Loading (`spinner` / `PageSkeleton`)
전역 로딩 UI. 라우트 전환 시 **즉시 피드백**을 줘 "지연 = 오류" 오인을 막는다. 각 주요 라우트에 `loading.tsx` 폴백 배치.
- **`spinner`**: 코랄 회전 링(2.5px, `--card-strong` 트랙 + `--coral` 헤드). 중앙 배치 `loading-screen` 또는 클라이언트 액션 인라인.
- **`PageSkeleton`**: 앱바 라인 + 카드 스켈레톤(shimmer). 리스트형 페이지의 Suspense 폴백.
- 컴포넌트: `src/components/Loading.tsx` (기본 export = 중앙 스피너).

### Confirm Dialog (`confirm-box`)
하단 고정 확인 다이얼로그 + `scrim`. 파괴적 액션 확인용.
- **삭제 시 개수 명시**: 직접 등록 글 삭제 확인에는 달린 **인사이트 N개·댓글 M개**를 문구에 노출("…삭제하면 모두 함께 사라져요"). 참여가 없으면 일반 문구.
- 버튼: `button-outline`(취소) + `button-danger`(삭제, 진행 중 "삭제 중…").

### Inputs / Search
- **`input`**: bg `{colors.canvas}`, `1px {colors.hairline}`, `{rounded.lg}`, focus 테두리 `{colors.ink}`.
- **`searchbar`**: bg `{colors.surface}`, `{rounded.full}`. **위치는 기존 유지**(앱바 아래 독립 행).

### My — 프로필 / 로그아웃
프로필 행: 아바타 + 이름/역할 + **로그아웃(`logout-sm`)을 우측에 소형 아웃라인 pill**로. 하단 대형 버튼 아님.

### 빈 상태 / 인증 안내
- **북마크 없음**: 홈 '북마크 글' 섹션이 비면 큐레이션 카드 대신 안내 — "북마크한 글이 여기 모여요 · 마음에 드는 글에 북마크를 눌러보세요" + 동사형 버튼(피드로 이동, 선택).
- **비로그인 북마크 시도**: 로그아웃 상태에서 카드/상세의 북마크 버튼을 누르면 저장 대신 **로그인 안내**(구글 로그인 유도 시트/토스트). 다른 개인화·파괴적 액션도 동일 패턴.

### Navigation — **기존 유지**
- **앱바**: 로고(insight**.** — 점 코랄) + 우측 **알림 벨**(유지). 하단 `1px {colors.hairline}`.
- **탭바**: 하단 고정 **4탭 — 홈 / 피드 / 인사이트 / 마이**(유지, 변경 안 함). 활성 `{colors.ink}`, 비활성 `{colors.steel-text}`.
- **아이콘**: 앱 자체 SVG 아이콘셋(`Icon.tsx`) 유지. 레퍼런스의 Material Symbols는 참고용.

## Do's and Don'ts

### Do
- 대표 CTA는 검정 알약.
- 코랄은 뱃지·FAB·히어로 글로우·활성 점·활성 별에만.
- 홈은 오늘의 글(다크 히어로 1장) → 인기 글(2열 그리드) → 북마크·기업(전체보기 있는 peek 스와이프) 순으로 성격을 구분.
- 모든 리스트 카드는 통일 카드 메타를 같은 순서로 — 커버 카드(홈·피드)든 리스트 로우(검색·마이)든 한 가족.
- 모든 버튼·칩·탭·뱃지 `{rounded.full}`.
- 모든 텍스트 Pretendard.
- 기업은 실제 로고 마크로.

### Don't
- 코랄·파랑을 본문/넓은 면에 쓰지 말 것.
- 버튼 모서리를 알약보다 각지게 하지 말 것.
- **DM Sans·JetBrains Mono 등 별도 서체 도입 금지** — 전부 Pretendard.
- 알림 벨·하단 탭바를 디자인 리프레시 명목으로 바꾸지 말 것.
- 흰 카드에 무거운 그림자 금지.
- 파랑을 주요 CTA로 되돌리지 말 것.

## Responsive
- 기본 모바일(480px 셸). 데스크톱도 480px 중앙 컬럼.
- 오늘의 글: 히어로 1장 full-bleed. 인기 글: 2열 그리드. 큐레이션 로우(북마크·기업): `flex 0 0 76%` peek 스와이프 + 전체보기.
- FAB·탭바는 `env(safe-area-inset-bottom)` 고려. 터치 타깃 최소 44px.

## Known Gaps / Notes
- **PWA**: `manifest.ts`(standalone·portrait, theme `#161616`) + 앱 아이콘(`icon.svg`, `icon-192/512.png`, `apple-icon.png` 180). 폰 "홈 화면에 추가" 시 앱처럼 설치. 아이콘 = 검정 타일 + 흰 "i" + 코랄 점.
- **폰트**: Pretendard만 CDN 로드. DM Sans/JetBrains Mono 링크 제거.
- **로고 자산**: 기업별 SVG 심볼 맵(`PostCard`), 신규 기업은 이니셜 폴백.
- **다크 모드**: 대비 유지 원칙만. 정식 팔레트 추후.
- **애니메이션**: 상태 전환 150–200ms ease. 카드 rise 유지.

## Iteration Guide
1. 한 번에 한 컴포넌트씩. `globals.css` 토큰 → 클래스 순.
2. 토큰명 직접 참조(`{colors.ink}`, `{rounded.full}`).
3. 새 변형은 `-active`/`-disabled` 별도 항목.
4. 본문 `{typography.body}`, 강조는 weight. 헤드라인 appbar→display-title→hero→card-title.
5. 브랜드색이 일반 버튼/면에 등장하면 "그 자리를 벌었는가" 자문.
