# 글 상세 분석 v2 구현 계획

## 1. 목표

글 상세 화면의 `lead`, `points`, `concepts`, `tools`를 최종 v2 프롬프트 기준으로 생성하고 서비스에 표시한다.

처리 경로는 두 가지로 분리한다.

1. **초기 백필**: 기존 약 100개 글은 Claude Code 에이전트가 일괄 분석하고, 검증된 결과를 DB에 반영한다.
2. **운영 자동화**: 이후 새로 수집되는 글은 Gemini API가 같은 프롬프트와 스키마로 분석해 DB에 저장한다.

초기 백필에서는 Gemini 무료 API의 일일 요청 한도를 사용하지 않는다. 운영 자동화에서만 Gemini API를 사용한다.

## 2. 기준 문서

- 최종 프롬프트: [`hyeran/techblog-article-detail-prompt-v2.md`](./techblog-article-detail-prompt-v2.md)
- 대상 앱: `yeongjin/techblog-archive-v2`
- 현재 상세 분석 코드: `yeongjin/techblog-archive-v2/src/core/1-analyze/analyze.ts`
- 현재 상세 백필 코드: `yeongjin/techblog-archive-v2/scripts/run/backfill-detail.mts`
- 현재 상세 화면: `yeongjin/techblog-archive-v2/src/app/articles/[id]/page.tsx`

프롬프트를 코드에서 임의로 보완하거나 예시를 추가하지 않는다. Claude Code 초기 백필과 Gemini 운영 경로가 동일한 v2 프롬프트와 출력 구조를 사용해야 한다.

## 3. 최종 출력 구조

```ts
interface DetailV2 {
  lead: {
    what: string;
    why: string;
    how: string;
    soWhat: string;
  };
  points: string[]; // 2~3개
  concepts: {
    term: string;
    what: string;
    why: string;
  }[]; // 0~3개
  tools: {
    name: string;
    description: string;
  }[]; // 0~2개
}
```

현재 서비스의 `Learning` 구조에는 다음처럼 매핑한다.

| v2 출력 | 현재 `Learning` 저장 위치 |
|---|---|
| `lead.what` | `overview.what` |
| `lead.why` | `overview.why` |
| `lead.how` | `overview.actions` |
| `lead.soWhat` | `overview.results` |
| `points` | `overview.takeaways` |
| `concepts` | `concepts` |
| `tools` | 새 필드 `tools` |
| 프롬프트 버전 | 새 필드 `detailPromptVersion: 2` |

`articles.learning`은 이미 Supabase의 `jsonb` 필드이므로 새 SQL 컬럼은 필요하지 않다. TypeScript 타입, 생성 로직, 가져오기 로직, 화면만 확장한다.

## 4. 구현 원칙

- 기존 `learning` 전체를 새 결과로 덮어쓰지 않는다.
- `overview`, `concepts`, `tools`, `detailPromptVersion`만 병합한다.
- 분석 실패 시 기존 상세 결과를 유지한다.
- 같은 글을 다시 실행해도 중복 데이터가 생기지 않아야 한다.
- 원문 전체와 생성 결과 JSONL은 Git에 커밋하지 않는다.
- API 키, Supabase 키 등 비밀값은 로그나 결과 파일에 기록하지 않는다.
- 전체 반영 전에 기존 상세 결과를 복구 가능한 파일로 백업한다.
- 초기 백필과 신규 글 자동 분석은 동일한 검증 함수를 통과해야 한다.

## 5. 1단계: 공통 타입과 검증기 구현

### 수정 대상

- `src/core/shared/types.ts`
- 새 파일 권장: `src/core/1-analyze/detail-v2.ts`

### 작업

1. `ArticleTool` 타입을 추가한다.

   ```ts
   export interface ArticleTool {
     name: string;
     description: string;
   }
   ```

2. `Learning`에 다음 선택 필드를 추가한다.

   ```ts
   tools?: ArticleTool[];
   detailPromptVersion?: 2;
   ```

3. `DetailV2` 원시 출력 타입과 JSON 스키마를 한곳에 정의한다.

4. Claude Code 결과와 Gemini 결과가 함께 사용하는 `validateDetailV2()`를 구현한다.

### 필수 검증

- `lead` 네 필드가 모두 비어 있지 않다.
- `points`는 2~3개다.
- `concepts`는 0~3개다.
- `tools`는 0~2개다.
- 모든 문장은 문자열이며 앞뒤 공백을 제거한 뒤 비어 있지 않다.
- `concepts.term`과 `tools.name`은 같은 배열 안에서 중복되지 않는다.
- 대문자 약어로 보이는 `term`은 `약어 (풀네임)` 형식인지 검사한다.
- 원문에 없는 숫자를 새로 만들지 않았는지 기존 `numbersIn()` 검사 로직을 재사용한다.
- 실패 시 DB에 저장하지 않고 글 ID와 검증 사유를 보고한다.

검증기는 내용을 대신 판단하지 않는다. 개념의 중요성처럼 모델 판단이 필요한 부분을 블랙리스트로 과도하게 규칙화하지 않는다.

## 6. 2단계: Claude Code 초기 백필 경로

Claude Code를 서비스 런타임에 연결하지 않는다. 로컬에서 한 번 실행하는 데이터 마이그레이션 작업으로 사용한다.

### 6.1 입력 내보내기 스크립트

새 스크립트 권장:

```text
scripts/run/export-detail-v2-input.mts
```

역할:

- DB에서 `status = included`인 글을 조회한다.
- `id`, `title`, `company`, `url`, 정제한 전체 원문 텍스트만 JSONL로 내보낸다.
- 기본적으로 `detailPromptVersion !== 2`인 글만 대상으로 한다.
- `--ids=8,22,42`, `--all` 옵션을 지원한다.
- 본문이 없거나 너무 짧은 글은 별도 실패 목록으로 기록한다.

권장 출력:

```text
data/detail-v2/input.jsonl
data/detail-v2/input-errors.jsonl
```

`data/detail-v2/*.jsonl`은 `.gitignore`에 추가한다. 원문 전체를 저장소에 올리지 않는다.

### 6.2 Claude Code 분석

Claude Code에 다음을 요청한다.

```text
hyeran/techblog-article-detail-prompt-v2.md를 기준으로
data/detail-v2/input.jsonl의 각 글을 분석하세요.
각 입력 ID마다 DetailV2 JSON 한 줄을 생성해
data/detail-v2/output.jsonl에 저장하세요.
원문이나 기존 필드를 수정하지 마세요.
중간에 실패한 ID는 data/detail-v2/output-errors.jsonl에 기록하고 계속 진행하세요.
```

권장 처리 단위는 10~20개다. 한 대화의 문맥이 지나치게 길어지지 않게 배치를 나누고, 각 배치 결과는 즉시 파일에 저장한다.

출력 한 줄 형식:

```json
{"id":8,"detail":{"lead":{"what":"...","why":"...","how":"...","soWhat":"..."},"points":["..."],"concepts":[],"tools":[]}}
```

### 6.3 검증 스크립트

새 스크립트 권장:

```text
scripts/check/validate-detail-v2.mts
```

역할:

- 입력 ID와 출력 ID가 일치하는지 확인한다.
- 누락, 중복, JSON 오류를 찾는다.
- 모든 결과에 `validateDetailV2()`를 적용한다.
- 성공 건수와 실패 사유를 요약한다.
- 검증 실패가 한 건이라도 있으면 종료 코드 1을 반환한다.

명령 예시:

```bash
npm run validate-detail-v2 -- --input=data/detail-v2/output.jsonl
```

### 6.4 DB 반영 스크립트

새 스크립트 권장:

```text
scripts/run/import-detail-v2.mts
```

지원 옵션:

- `--input=...`: 가져올 JSONL
- `--dry`: DB를 수정하지 않고 변경 예정 내용만 출력
- `--ids=...`: 일부 ID만 반영
- `--force`: 이미 v2인 글도 명시적으로 다시 반영

반영 순서:

1. 대상 글의 현재 `learning`을 조회한다.
2. 자동 백업 파일을 만든다.
3. `DetailV2`를 검증한다.
4. 기존 `learning`을 복사한다.
5. `overview`, `concepts`, `tools`, `detailPromptVersion`만 병합한다.
6. `markIncluded()`로 저장한다.
7. 저장 후 다시 읽어 값이 일치하는지 확인한다.

백업 예시:

```text
data/detail-v2/backups/2026-10-28Txxxxxx-before-import.jsonl
```

현재의 `import-analysis.mts`는 `learning` 전체를 받을 수 있으므로 이번 용도에 그대로 사용하지 않는다. 상세 필드만 병합하는 전용 스크립트를 만든다.

## 7. 3단계: 상세 화면 구현

### 수정 대상

- `src/app/articles/[id]/page.tsx`

### 작업

1. 기존 `overview`와 `concepts` 표시는 유지한다.
2. `learning.tools`가 있을 때만 자체 도구 영역을 표시한다.
3. `tools`는 개념 카드처럼 크게 만들지 않고 각주 형태로 간단히 표시한다.

권장 화면:

```text
글에 나온 도구·프로그램

우아한공방 — 우아한형제들이 디자이너와 개발자의 협업을 위해 만든 사내 디자인시스템이에요.
```

4. `tools`가 빈 배열이거나 필드가 없는 기존 데이터에서는 영역 전체를 숨긴다.
5. 모바일과 데스크톱에서 긴 이름과 설명이 자연스럽게 줄바꿈되는지 확인한다.
6. 기존 v1 데이터에 `tools`와 `detailPromptVersion`이 없어도 화면이 깨지지 않아야 한다.

## 8. 4단계: Gemini 신규 글 자동 분석

### 수정 대상

- `src/core/1-analyze/analyze.ts`
- `src/core/pipeline.ts`
- `src/core/shared/ai.ts`
- `scripts/run/backfill-detail.mts`
- `.env.local.example`
- `README.md`

### 작업

1. 기존 `DETAIL_SYS`, 긴 예시, 예시 전용 후처리를 제거한다.
2. v2 MD의 System prompt를 운영 코드에 정확히 이식한다.
3. 운영 코드의 JSON 스키마를 `DetailV2`와 일치시킨다.
4. 생성 결과를 다음과 같이 저장한다.

   ```ts
   learning.overview = {
     what: detail.lead.what,
     why: detail.lead.why,
     actions: detail.lead.how,
     results: detail.lead.soWhat,
     takeaways: detail.points,
   };
   learning.concepts = detail.concepts;
   learning.tools = detail.tools;
   learning.detailPromptVersion = 2;
   ```

5. `attachDetail()`이 네 필드를 한 번에 갱신하도록 수정한다.
6. 운영 모델은 별칭 대신 고정 모델을 사용한다.

   ```env
   GEMINI_DETAIL_MODEL=gemini-3.6-flash
   ```

7. 상세 분석은 `thinkingLevel: low`를 사용한다.
8. 요청별 제한시간을 설정하고 429, 503, timeout을 구분해 기록한다.
9. 503은 제한된 횟수만 지수 백오프로 재시도한다.
10. 일일 한도 429는 재시도하지 않고 다음 수집 주기로 넘긴다.
11. `detailPromptVersion === 2`인 글은 기본적으로 다시 생성하지 않는다.

MD와 코드 프롬프트가 달라지는 것을 막기 위해, 테스트에서 MD의 System prompt와 코드 상수의 정규화된 문자열 또는 해시가 같은지 검사한다.

## 9. 5단계: 실행 순서

### A. 백필 경로 먼저 구현

1. 타입과 검증기 구현
2. export / validate / import 스크립트 구현
3. 타입 검사와 린트 통과

이 시점에는 기존 DB 데이터를 변경하지 않는다. 기존 글은 기존 결과로 계속 표시한다.

화면 구현(7장)과 Gemini 신규 글 경로(8장)는 백필(B·C)이 끝난 뒤 진행한다. 현재 화면은 `overview`·`concepts`를 그대로 표시하므로 v2 데이터를 넣어도 깨지지 않고, `tools`는 화면이 생기기 전까지 표시되지 않을 뿐이다. 실제 v2 결과를 보면서 화면을 다듬기 위해 이 순서로 한다.

현재 DB의 `overview`·`concepts`는 미란 님이 v1 프롬프트로 백필한 93건(2026-10-23, 커밋 51e99b4)이다. 이번 백필은 이 값을 v2로 교체하는 작업이며, import 전 백업이 v1으로 되돌릴 유일한 기준이다.

### B. 소량 DB 반영 검증

1. 성격이 다른 대표 글 5개를 Claude Code로 생성한다.
2. `validate-detail-v2`를 통과시킨다.
3. `import-detail-v2 --dry --ids=...`로 변경 내용을 확인한다.
4. 실제 DB에 반영한다.
5. 서비스 화면에서 `lead`, `points`, `concepts`, `tools`를 확인한다.
6. 기존 분류, 태그, 카드 문구가 유지됐는지 확인한다.

권장 대표 글:

- 8번: AI 개발 사례, 자체 디자인시스템 포함
- 9번: 브라우저 기술 개념 중심
- 22번: 인증 약어가 많은 글
- 42번: 로그·추적 개념과 자체 컴포넌트 포함
- 177번: 분산 시스템 개념 중심

### C. 전체 초기 백필

1. 나머지 글을 10~20개 단위로 Claude Code 분석
2. 배치별 검증
3. 배치별 dry-run
4. 배치별 DB 반영
5. 실패 목록만 재처리
6. 전체 감사 보고서 생성

한 번에 100개를 생성하고 마지막에 검증하지 않는다. 배치마다 결과와 Claude Code 사용량을 확인한다.

## 10. 감사 보고서

새 검사 스크립트 또는 기존 `audit.mts` 확장으로 다음을 출력한다.

- 포함 글 전체 수
- `detailPromptVersion === 2`인 글 수
- v2 미적용 글 ID
- overview 누락 글 ID
- concepts 3개 초과 글 ID
- tools 2개 초과 글 ID
- 약어 풀네임 형식 의심 항목
- 빈 문자열 또는 중복 항목
- 원문이 없어 처리하지 못한 글 ID

예상 예외로 확인된 11번과 12번은 원문 부재 여부를 다시 확인하고, 실제로 본문이 없으면 실패 목록에 이유와 함께 남긴다.

## 11. 테스트와 완료 조건

### 코드 검증

- TypeScript 검사 통과
- ESLint 통과
- Next.js 프로덕션 빌드 통과
- v1 데이터가 있는 상세 화면 정상 표시
- v2 데이터가 있는 상세 화면 정상 표시
- tools가 없는 글에서 자체 도구 영역이 숨겨짐
- 잘못된 JSONL이 DB에 저장되지 않음
- dry-run에서 DB가 변경되지 않음
- 동일 JSONL을 두 번 반영해도 결과가 중복되지 않음

### 데이터 완료 조건

- 원문이 있는 대상 글 100%가 `detailPromptVersion: 2`
- 각 결과가 공통 검증기를 통과
- 실패 글은 ID와 사유가 별도 목록에 존재
- 기존 `learning`의 분류·태그·카드·질문 데이터가 보존됨
- 반영 전 백업 파일로 상세 필드를 복구할 수 있음

### 운영 완료 조건

- 새 글은 Gemini API로 v2 결과를 생성
- Gemini 실패가 전체 수집 파이프라인을 중단하지 않음
- API 일일 한도 초과 시 기존 글과 서비스 화면에 영향이 없음
- 다음 실행에서 미처리 신규 글만 다시 처리

## 12. 롤백

문제가 발견되면 다음 순서로 복구한다.

1. 신규 Gemini 상세 분석을 환경변수 또는 코드 플래그로 중지한다.
2. 자동 생성한 반영 전 백업 JSONL을 사용한다.
3. 상세 필드만 이전 값으로 병합한다.
4. `tools` 영역은 필드가 없으면 자동으로 숨겨지므로 별도 DB 마이그레이션 롤백은 필요 없다.
5. 프롬프트 코드는 이전 커밋으로 되돌리되 다른 `learning` 필드는 건드리지 않는다.

## 13. Claude Code 작업 요청문

Claude Code에서 아래 요청문으로 시작한다.

```text
hyeran/techblog-article-detail-v2-implementation-plan.md를 읽고 계획대로 구현하세요.
최종 프롬프트는 hyeran/techblog-article-detail-prompt-v2.md를 단일 기준으로 사용하세요.

먼저 공통 타입·검증기, JSONL export/validate/import 스크립트, 상세 화면, Gemini 신규 글 경로를 구현하고 테스트하세요.
기존 learning 전체를 덮어쓰지 말고 overview, concepts, tools, detailPromptVersion만 병합하세요.
원문과 생성 결과 JSONL, API 키, Supabase 키는 Git에 커밋하지 마세요.

코드 구현과 테스트가 끝난 뒤 DB를 바로 전체 변경하지 마세요.
대표 글 5개의 export와 dry-run까지 진행한 다음 결과를 보고하고 승인을 기다리세요.
```
