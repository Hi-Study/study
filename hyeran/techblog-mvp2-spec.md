# Tech Blog Curator — MVP v0 Spec

## 1. 제품 한 줄 정의

**한국 테크기업이 발행한 글 중 비개발자도 읽을 가치가 있는 글을 선별하고, 쉽게 이해할 수 있도록 요약·설명해주는 서비스.**

전문 개발자만을 위한 기술 뉴스/개발 글 모음이 아니다.

주요 사용자는 다음과 같다.

- PM / PO / 기획자
- 마케터
- 디자이너
- 바이브 코더
- AI와 기술 트렌드에 관심 있는 사람
- 개발자가 아니지만 테크기업의 제품·문제 해결 방식을 알고 싶은 사람

---

## 2. 해결하려는 문제

한국 테크기업은 좋은 글을 많이 발행하지만 다음과 같은 문제가 있다.

1. 회사별 블로그를 직접 찾아다녀야 한다.
2. 개발 지식이 없으면 제목만 보고 읽을 가치가 있는지 판단하기 어렵다.
3. 긴 글을 끝까지 읽기 전에는 핵심을 파악하기 어렵다.
4. 낯선 기술 용어 때문에 좋은 글도 진입 장벽이 생긴다.
5. 구현 디테일 중심 글과 일반 독자에게도 의미 있는 글이 섞여 있다.

서비스는 이 진입 비용을 낮추는 것을 목표로 한다.

---

## 3. 제품 원칙

### 3.1 기술 자체보다 기술로 무엇을 했는지를 본다

다음에 집중한다.

- 어떤 문제가 있었는가
- 왜 이런 선택을 했는가
- 무엇을 시도했는가
- 결과가 어땠는가
- 무엇을 배웠는가

구현 방법 자체는 핵심이 아니다.

### 3.2 AI 요약은 원문을 대체하지 않는다

요약의 역할은 원문을 읽기 위한 **Soft Landing**이다.

사용자가 다음을 빠르게 판단할 수 있어야 한다.

> 이 글이 나에게 의미가 있는가?

가치가 있다면 원문으로 이동하도록 한다.

### 3.3 비개발자의 기술적 배경 부족 때문에 좋은 글을 놓치지 않게 한다

어려운 기술 개념이 등장하더라도 글 자체에 제품·AI·UX·성장·문제 해결 측면의 가치가 있다면 제외하지 않는다.

대신 필요한 개념을 쉽게 설명한다.

---

## 4. 콘텐츠 수집 범위

한국 테크기업의 공식 콘텐츠를 대상으로 한다.

페이지 이름이 반드시 `Tech Blog`일 필요는 없다.

다음 주제의 공식 콘텐츠도 포함할 수 있다.

- Technology
- AI
- Product
- Data
- Design / UX
- Growth
- 조직 / 협업
- 일하는 방식

### MVP 초기 수집 후보

- 토스
- 당근
- 우아한형제들
- 네이버 D2
- 컬리
- 무신사
- 쿠팡 Engineering
- 데브시스터즈
- LINE Engineering
- 카카오엔터프라이즈
- 오늘의집

향후 수집 가능한 기업을 추가한다.

---

## 5. 수집 방식

MVP의 기본 수집 방식은 RSS / Atom이다.

```text
기업 블로그
    ↓
RSS / Atom
    ↓
새 글 발견
    ↓
글 URL 확보
    ↓
본문 추출
    ↓
AI 분석
    ↓
DB 저장
```

RSS가 없는 사이트 때문에 처음부터 범용 크롤러를 만들지 않는다.

원칙:

1. RSS / Atom이 있으면 사용
2. 다른 간단한 공식 수집 방법이 있으면 사용
3. 수집 난도가 높은 사이트는 MVP에서 제외 가능

---

## 6. 어떤 글을 보여줄 것인가

핵심 질문은 다음과 같다.

> **개발자가 아닌 사람이 읽어도 제품, AI, 기술 트렌드, 디자인, 성장, 일하는 방식 등에 대해 의미 있는 것을 배울 수 있는가?**

### 우선적으로 보여줄 글

- 새로운 AI / 기술 트렌드
- 실제 AI 제품 적용 사례
- AI를 업무에 활용한 사례
- 제품을 만들거나 개선한 과정
- 사용자 행동에서 얻은 인사이트
- Growth / 실험 사례
- 디자인 / UX 의사결정
- 중요한 기술적 선택과 Trade-off
- 실제 서비스 문제 해결 과정
- 조직 / 협업 / 일하는 방식
- 실패와 그로부터 얻은 교훈

### 기본적으로 제외할 글

- Framework 사용법
- Library 설정법
- 버전별 Migration
- API Reference
- 특정 Infra 설정
- 특정 언어 / Stack 구현 디테일
- 좁은 Troubleshooting
- 코드 자체가 중심인 글

단, 기술적으로 깊은 글이라도 **제품·사용자·비즈니스·문제 해결·기술 트렌드 관점에서 일반화 가능한 인사이트가 있다면 포함할 수 있다.**

---

## 7. Category

Category는 기술 분야를 분류하기 위한 것이 아니다.

다음 질문에 답해야 한다.

> **이 글에서 무엇을 배울 수 있는가?**

MVP Category:

- AI & Trends
- Product
- Growth & Marketing
- Design & UX
- Building with AI
- How We Work
- Behind the Product

### Behind the Product

기술적인 내용이 포함되어 있더라도 실제 제품에서 발생한 문제와 해결 과정 자체가 흥미로운 글.

예:

- 추천 시스템을 왜 바꿨는가
- 검색 경험을 어떻게 개선했는가
- 대규모 트래픽 문제 때문에 제품 구조를 어떻게 바꿨는가

---

## 8. Tags

Category보다 구체적인 주제를 표현한다.

예:

```text
AI Agent
Recommendation
Personalization
A/B Test
Search
Data
Workflow
Experiment
AI Coding
```

원칙:

- 글당 2~5개
- 기존 Tag 재사용을 우선
- 필요한 경우에만 새로운 Tag 생성
- MVP에서 완벽한 Taxonomy를 미리 설계하지 않는다

---

## 9. AI 분석 결과

AI는 수집한 글에 대해 다음을 생성한다.

```json
{
  "shouldShow": true,
  "category": "Product",
  "tags": [
    "Recommendation",
    "Personalization",
    "Experiment"
  ],
  "summary": {
    "what": "...",
    "why": "...",
    "keyPoints": [
      "...",
      "...",
      "..."
    ],
    "takeaway": "..."
  },
  "concepts": [
    {
      "name": "Recommendation System",
      "description": "...",
      "context": "이 글에서 이 개념이 등장하는 이유"
    }
  ]
}
```

### shouldShow

비개발자 타겟에게 의미 있는 글인지 판단한다.

MVP에서는 복잡한 점수 시스템을 만들지 않는다.

`true / false` 중심으로 시작한다.

---

## 10. 요약 구조

### 무슨 이야기야?

1~2문장으로 글 전체를 쉽게 설명한다.

### 왜 이런 걸 했어?

글이 다루는 문제와 배경을 설명한다.

### 핵심 내용

3~5개 정도.

구현 세부사항보다 다음을 중심으로 한다.

- 문제
- 선택
- 시도
- 결과
- 배운 점

### 그래서 뭘 배울 수 있어?

이 글에서 다른 사람도 가져갈 수 있는 인사이트를 설명한다.

특히 PM, 마케터, 디자이너, 바이브 코더 등 비개발자 관점에서도 의미가 있어야 한다.

---

## 11. 개념 설명

글을 이해하는 데 실제로 필요한 개념만 설명한다.

단순 사전식 정의를 피한다.

각 개념은 다음 두 가지를 포함한다.

### 이게 뭐야?

비전문가가 이해할 수 있는 표현으로 설명한다.

### 이 글에서 왜 나와?

해당 개념이 이 글에서 어떤 역할을 하는지 설명한다.

---

# 12. MVP IA

MVP는 Feed 중심으로 구성한다.

복잡한 메뉴 구조를 만들지 않는다.

## 12.1 Feed

Route:

```text
/
```

서비스의 기본 화면.

AI가 선별한 한국 테크기업의 글을 보여준다.

### Category Filter

Feed 상단에 둔다.

```text
[전체]
[AI]
[Product]
[Growth]
[Design]
[Building with AI]
[How We Work]
[Behind the Product]
```

모바일에서는 가로 스크롤 Chip 형태로 사용할 수 있다.

Category는 별도의 메뉴라기보다 Feed Filter 역할을 한다.

### Article Card

각 Card에는 다음 정보를 보여준다.

```text
회사

제목

Category
Tags

무슨 이야기야?

그래서 뭘 배울 수 있어?

[요약 보기] [원문 읽기]
```

사용자가 상세 화면에 들어가지 않아도 글을 읽을 가치가 있는지 어느 정도 판단할 수 있어야 한다.

---

## 12.2 Article Detail

Route:

```text
/articles/:id
```

구성:

```text
회사 / 작성일

제목

Category
Tags

────────────

무슨 이야기야?

────────────

왜 이런 걸 했어?

────────────

핵심 내용

────────────

그래서 뭘 배울 수 있어?

────────────

읽기 전에 알아두면 좋은 개념

────────────

원문 읽기
```

위에서 아래로 읽으면서 원문을 읽을 준비를 할 수 있도록 한다.

---

## 12.3 Tag Filter

Tag 클릭 시 기존 Feed를 필터링한다.

별도 페이지를 만들 필요는 없다.

예:

```text
/?tag=ai-agent
/?tag=personalization
```

---

## 12.4 Company Filter

회사명을 클릭하면 해당 회사의 글만 보여준다.

예:

```text
/?company=toss
/?company=daangn
/?company=ohouse
```

MVP에서는 별도의 회사 소개 페이지를 만들지 않는다.

---

## 13. Navigation

Header는 최소화한다.

```text
[서비스명]                             
```

그 아래 Category Filter를 배치한다.

검색은 콘텐츠가 충분히 쌓인 이후 추가할 수 있다.

MVP에서 핵심 화면은 사실상 두 개다.

```text
Feed
/

Article Detail
/articles/:id
```

---

# 14. Curation

큐레이션은 제품에서 중요할 가능성이 높지만 **MVP v0에서는 구현하지 않는다.**

현재까지 생각한 큐레이션의 역할은:

> 여러 회사의 글을 하나의 주제나 관점으로 묶어 사용자가 흐름을 이해하도록 돕는 것.

예:

- 한국 테크기업은 AI를 실제 업무에 어떻게 쓰고 있을까?
- 제품팀이 실험에서 배운 것들
- 요즘 주목할 기술
- 디자이너가 읽어볼 만한 AI 이야기

다만 현재는 **큐레이션 기준과 편집 판단을 AI에게 지나치게 맡길 위험이 있다.**

따라서 먼저 Feed와 Article 경험을 구현하고 실제로 사용해본 뒤 다음을 결정한다.

- 어떤 기준으로 글을 묶을 것인가
- 사람이 정하는 기준과 AI의 역할을 어떻게 나눌 것인가
- 자동 생성인지 편집형인지
- 홈에서 어떻게 노출할 것인가
- 별도의 Curation 화면이 필요한가

즉, Curation은 삭제한 기능이 아니라 **의도적으로 보류한 다음 단계 기능**이다.

---

# 15. MVP v0 구현 범위

## 구현

1. Home / Feed
2. Category Filter
3. Article Card
4. Article Detail
5. Tag Filter
6. Company Filter
7. Desktop / Mobile Responsive
8. Mock Data

### Mock Data 회사

초기 화면에서는 실제 수집기를 먼저 만들 필요가 없다.

다음 회사들의 가상/샘플 Article 데이터를 사용해 제품 경험을 확인한다.

- 토스
- 당근
- 오늘의집
- 우아한형제들
- 컬리
- 네이버 등

---

## 구현하지 않음

v0에서는 다음을 제외한다.

- Curation
- 로그인
- 개인화
- 추천 알고리즘
- Vector DB
- Embedding
- 복잡한 Scoring
- 검색
- 실제 RSS 수집 파이프라인
- 범용 Web Crawler
- 관리자 페이지
- Trend Analytics

---

# 16. 초기 기술 스택

과도한 구조를 만들지 않는다.

권장:

```text
Next.js
TypeScript
Tailwind CSS
App Router
```

첫 구현에서는 Backend / DB 없이 Mock Data로 시작해도 된다.

예:

```text
src/
  app/
    page.tsx
    articles/
      [id]/
        page.tsx

  components/
    Header.tsx
    CategoryFilter.tsx
    ArticleCard.tsx
    Tag.tsx

  data/
    articles.ts

  types/
    article.ts
```

구조는 구현 과정에서 필요 이상으로 추상화하지 않는다.

---

# 17. 구현 순서

```text
1. Mock Article Data
        ↓
2. Feed
        ↓
3. Category Filter
        ↓
4. Article Detail
        ↓
5. Tag / Company Filter
        ↓
6. Mobile Responsive
        ↓
7. 직접 사용해보기
        ↓
8. Curation 재설계
        ↓
9. 실제 RSS 수집 연결
```

---

# 18. MVP 검증 질문

첫 버전을 직접 사용하면서 다음을 확인한다.

### Discovery

여러 회사 블로그를 돌아다니지 않아도 읽을 만한 글을 발견할 수 있는가?

### Filtering

개발 구현 디테일 중심 글이 적절히 제거되어 있는가?

### Understanding

개발자가 아니어도 요약과 개념 설명만으로 글의 맥락을 이해할 수 있는가?

### Value

`그래서 뭘 배울 수 있어?`가 실제로 글을 읽을지 판단하는 데 도움이 되는가?

### Original Content

요약을 읽은 뒤 좋은 글은 원문까지 읽고 싶어지는가?

### Curation

Feed를 실제로 사용해보니 어떤 주제의 글들을 묶어서 보고 싶은가?

이 마지막 질문을 기반으로 다음 버전에서 Curation을 설계한다.

---

# 19. 핵심 사용자 경험

서비스에 들어온 사용자는 다음 흐름을 경험해야 한다.

```text
서비스 접속

↓ 

"요즘 한국 테크기업에서
읽어볼 만한 게 뭐가 있지?"

↓

Feed 탐색

↓

제목 + 쉬운 설명 +
왜 읽을 만한지 확인

↓

관심 있는 글 선택

↓

배경 / 핵심 / 개념 이해

↓

"이건 원문도 읽어보고 싶다"

↓

원문 이동
```

이 흐름이 MVP v0의 가장 중요한 경험이다.
