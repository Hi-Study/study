# techblog-perspective — 개발 가이드

관점 아카이브 앱. 서비스 소개와 문서 읽는 순서는 상위 폴더 `README.md` 와 [`docs/00_서비스_개요.md`](docs/00_서비스_개요.md) 에 있다.
이 문서는 **코드를 고치거나 돌리는 사람**을 위한 것이다.

- Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · Pretendard
- 저장소: Node 내장 `node:sqlite` — `data/app.db` (로그인 없음, 로컬 데모)
- AI: Gemini `gemini-flash-lite-latest`

---

## 실행

```bash
npm install
cp .env.local.example .env.local      # GEMINI_API_KEY=… (화면만 볼 거면 비워도 된다)
npm run fetch-logos                   # 회사 로고 받기 — 상표라 저장소에 없다 (안 받으면 회사 이름 첫 글자로 보인다)
npm run dev                           # http://localhost:3000
```

Node 22.5 이상 (`node:sqlite`). 이 저장소에는 `data/app.db` 가 들어 있지 않다 — 처음이면 `npm run collect` 로 모은다.

---

## 코드 지도 — 서비스 흐름 순서

```
src/core/
├─ 0-collect/         ① 모으기          docs/01 · 0단계
│   ├─ companies.ts      수집 대상 블로그 18곳
│   ├─ logos.ts          회사 로고 찾기 (public/logos/ — 저장소에 없음, fetch-logos 로 받음)
│   ├─ sources.ts        RSS·Atom·목록 페이지 읽기, 티저면 원문 다시 받기
│   ├─ content.ts        HTML 정제, 텍스트 추출, 블록 나누기 (칸의 근거 번호 = 블록 번호)
│   └─ thumbnail.ts      og:image → 본문 첫 이미지, 사이트 기본 이미지 걸러내기
│
├─ 1-analyze/         ② 읽기            docs/01 · 1~2단계
│   ├─ analyze.ts        배제 판정 · 상세 분석 · "더 들어가 볼까요?" 프롬프트
│   ├─ guide-gate.ts     칸 코드 게이트 (질문형, 숫자 대조, 말투 …)
│   └─ annotate.ts       상세 화면 원문 하이라이트
│
├─ 2-classify/        ③ 경험으로 묶기    docs/01 · 3~8단계
│   ├─ taxonomy.ts       분류 체계 — 부담·경험·누구·적합도·방식·기술 (+ 화면 문구)
│   └─ classify.ts       경험 사슬 프롬프트 + 코드 규칙 + 카드 문구 검사
│
├─ 3-place/           ④ 홈에 놓기        docs/02
│   └─ home.ts           홈 자리별로 고르고 세는 규칙
│
├─ shared/            공용
│   ├─ ai.ts             Gemini 연결 — 호출 간격, 재시도, 스키마 도우미
│   ├─ db.ts             SQLite 읽기·쓰기
│   ├─ types.ts          단계 사이를 오가는 데이터 모양
│   └─ local-store.ts    브라우저 저장 (북마크·읽은 글·최근 검색어)
│
└─ pipeline.ts        글 하나를 1단계 → 8단계로 통과시키는 실행 순서
```

```
src/app/              ⑤ 화면 — 주소가 곧 폴더
│   page.tsx             홈
│   articles/[id]        글 상세          experiences/[slug]   경험 페이지
│   tech/[slug]          기술 페이지      feed · search · my · excluded
src/components/
│   home/                홈 자리별 UI — 새 글 카드 롤링, 경험 카드, 문제 카드, 기술 키워드 탭
│   article/             글 상세 UI — 원문·하이라이트, 기획자 관점 바텀시트, "더 들어가 볼까요?"
│   common/              여러 화면이 같이 쓰는 것 — 글 카드, 탭바, 검색창, 마이 목록
```

**의존 방향** — 위 단계는 아래 단계를 모른다.
`0-collect` ← `1-analyze` ← `2-classify` ← `3-place` ← `app`/`components`. 모두 `shared` 를 쓴다.
예외 하나: `shared/types.ts` 가 `2-classify/taxonomy.ts` 의 **타입 이름**(부담·경험 코드 등)을 가져온다 — 실행 코드는 참조하지 않는다.

---

## 명령어

| 명령 | 하는 일 | 단계 |
|---|---|---|
| **실행** `scripts/run/` | | |
| `npm run collect [-- N]` | 회사당 최신 N건(기본 6) 수집 → 썸네일 → 분석 대기 글을 1~8단계 처리 | 0~8 |
| `npm run reclassify` | 포함된 글의 3~8단계만 다시 (1·2단계 결과 유지) | 3~8 |
| `npm run reclassify -- --stale` | 최신 분류 버전보다 오래된 글만 | 3~8 |
| `npm run reclassify -- --ids=29,41` | 특정 글만 | 3~8 |
| `npm run reclassify -- --full` | 1단계부터 전부 다시 | 1~8 |
| `npm run add-url -- <URL>` | RSS 에 없는 글 1건 추가 | 0~8 |
| `npm run backfill-content` | 본문이 너무 짧게 저장된 글 다시 받기 | 0 |
| `npm run backfill-thumbnails` | 썸네일 아직 안 찾은 글 | 0 |
| `npm run fetch-logos` | 회사 로고 받기 → `public/logos/` (상표라 저장소에 없음 — 처음 받으면 한 번 실행) | 0 |
| **점검** `scripts/check/` | | |
| `npm run report` | 회사별 수집·포함·제외·대기 + 제외 이유 (01 문서 "수집 결과" 표의 원본) | 0~1 |
| `npm run audit` | 경험별 분포, 적합도, 근거 칸, 검토 필요 목록 | 3~8 |
| `npm run check-gemini` | AI 키·스키마 동작 확인 (호출 1회) | — |
| `npx tsx scripts/check/dump-article.mts <id>` | 글 하나를 블록 번호와 함께 출력 | 2 |
| **버전** `scripts/version/` | | |
| `npm run snapshot -- <URL> <이름>` | 실행 중인 서비스를 HTML 로 저장 → `versions/<이름>/` | — |
| `npm run version -- v01` | 저장한 버전 보기 → http://localhost:4001 | — |

**AI 한도** — 무료 키는 분당 15회 · 하루 500회. 호출 간격을 5초로 벌리고, 하루 한도에 걸리면 그 자리에서 멈춘다(한국 시간 오후 4~5시에 풀림). 멈춘 뒤에는 `--stale` 로 이어서 돌린다.

---

## 자주 하는 작업

**블로그 추가** — `core/0-collect/companies.ts` 에 한 줄 추가 (RSS 가 없으면 `listPage`) → `npm run fetch-logos` → `npm run collect`

**분류 기준 바꾸기** — `core/2-classify/classify.ts`(프롬프트·코드 규칙) 또는 `taxonomy.ts`(분류 체계) 수정 → `CLASSIFY_VERSION` 올리기 → `npm run reclassify -- --stale` → `npm run audit` 로 확인 → **`docs/01_분류기준.md` 같이 고치기**

**홈 자리 기준 바꾸기** — `core/3-place/home.ts`(고르고 세기) + `components/home/`(UI) → **`docs/02_홈배치기준.md` 같이 고치기**

**화면 버전 남기기** — `npm run build && npx next start -p 3100` → `npm run snapshot -- http://localhost:3100 v02` → 소스는 `git tag v02`, DB 는 `data/app.v02.db` 로 백업

> 코드가 정본이고 문서는 그 규칙을 옮긴 것이다. 기준을 바꾸면 같은 커밋에서 문서도 고친다.

---

## 버전

| 버전 | 소스 | 화면 | 데이터 |
|---|---|---|---|
| v01 | `git tag v01` | `versions/v01/` | `data/app.v01.db` |
