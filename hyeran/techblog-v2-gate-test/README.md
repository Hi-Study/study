# 거르기(1단계) 모델 비교 시험 묶음

영진님께 — 사이트의 글 거르기 판정을 **모델별로** 비교하기 위한 자료입니다. 배경은 [논의 자료](../techblog-v2-filter-discussion.md)에 있습니다.

## 들어 있는 것

| 파일 | 내용 |
|---|---|
| `articles-40.tsv` | 시험할 글 40건. `id` 는 사이트 글 번호(`/articles/<id>`, Supabase `articles.id`). 지금까지의 판정 결과(사이트·Sonnet·Haiku)가 같이 들어 있다 |
| `prompt-structured.txt` | 쪼갠 질문 방식 프롬프트 (아래 설명) |

지금 프롬프트는 따로 넣지 않았습니다 — `src/core/1-analyze/analyze.ts` 의 `GATE_SYS` 그대로입니다.
원문은 저작권 문제로 저장소에 넣지 않았습니다. Supabase 의 `content_html` 을 쓰면 됩니다.

### 40건은 어떻게 고른 건가

```
사이트가 모은 글 97건
├─ 사이트(Gemini)가 올린 글 73건
│   ├─ Claude Sonnet도 올린 글 48건
│   └─ Claude Sonnet은 뺀 글 25건  ← 갈린 글
└─ 사이트(Gemini)가 뺀 글 24건 → Sonnet도 모두 뺐다
```

97건을 모델마다 다 돌리기엔 비용이 커서, 아래 40건만 골랐다.

| `group` 값 | 건수 | 어디서 골랐나 | 무엇을 보려고 |
|---|---|---|---|
| `disputed` | 25 | 갈린 글 25건 **전부** | 새 모델이 이 글들을 빼는지 (가장 중요) |
| `both_included` | 8 | 둘 다 올린 48건 중 무작위 | 좋은 글을 실수로 빼지 않는지 |
| `both_excluded` | 7 | 둘 다 뺀 24건 중 무작위 | 뺄 글을 실수로 올리지 않는지 |

## 해 주실 것

같은 40건을 아래 조합으로 돌려 `include` 결과를 `articles-40.tsv` 에 열로 붙여 주세요.

| | 지금 프롬프트 | 쪼갠 질문 방식 |
|---|---|---|
| Gemini flash-lite (지금) | ✔ (이미 있음 = 사이트 결과) | ✔ |
| Gemini flash (한 단계 위) | ✔ | ✔ |
| Gemini pro | (선택) | (선택) |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | ✔ | ✔ |

- 입력은 지금과 같이 **제목 + 본문 전체**.
- 가능하면 조합마다 **2번씩** 돌려서 판정이 흔들리는 글이 있는지도 봐 주세요.

## 쪼갠 질문 방식

AI 에게 "넣을까 뺄까"를 묻지 않고, 세 가지만 고르게 한 뒤 **코드가 결정**한다.

- `q1` 글이 주로 다루는 것: `product` / `work` / `tech` / `concept` / `event` / `culture`
- `q2` 실제로 바뀐 사람: `customer` / `staff` / `developer` / `none`
- `q3` 그 변화를 보여주는 원문 문장 (그대로 복사)

출력: `{"q1":"...","q2":"...","q3":"..."}`

**결정 규칙 (지금 기준과 같은 범위)**
```ts
const include =
  ["product", "work"].includes(q1) &&
  q2 !== "none" &&
  normalize(content).includes(normalize(q3));   // 공백 제거 후 원문에 실제로 있어야 통과
```
- 개발자만 바뀐 글도 빼려면 `q2 !== "none"` 을 `["customer","staff"].includes(q2)` 로 바꾸면 된다(기준 논의 후 결정).

## 지금까지 결과 (참고)

| 판정 | 40건 중 통과 | disputed 25건 중 통과 |
|---|---|---|
| 사이트 (Gemini flash-lite + 지금 프롬프트) | 33 | 25 |
| Sonnet 5.5 + 지금 프롬프트 | 8 | 0 |
| Haiku 4.5 + 지금 프롬프트 | 12 | 6 |
| Haiku 4.5 + 쪼갠 질문 방식 | 8 | 4 |

- Sonnet·Haiku 는 API 가 아니라 Claude Code 에이전트가 원문을 웹에서 다시 받아 판정했다. 한 번씩만 돌렸다.
- 그래서 **같은 조건(API·Supabase 원문)으로 다시 돌린 결과**가 필요하다.
