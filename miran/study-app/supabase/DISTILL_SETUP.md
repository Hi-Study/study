# distill 백엔드 세팅 가이드 (Phase A)

테크블로그 글을 **자동 수집 → 본문·대표이미지·주제·태그 저장**하는 백엔드입니다.
아래 순서대로 실행하면 됩니다. (Claude 는 SQL 실행·함수 배포를 대신 못 하므로, 이 문서대로 직접 실행)

프로젝트 ref: **qripaoexmfcyrrdbcbfl** · 리전 대시보드: https://supabase.com/dashboard/project/qripaoexmfcyrrdbcbfl

---

## 구성 요소

| 파일 | 역할 |
|---|---|
| `distill_schema.sql` | 테이블·RLS·블로그 18개 시드 (데이터 모델) |
| `functions/collect/` | 신규 글 수집 엣지 함수(4가지 수집 방식) |
| `functions/_shared/feed.ts` | RSS/Atom 파서 + SPA 상태 본문 추출 |
| `functions/_shared/classify.ts` | 주제(7종)·태그 자동 분류 |
| `distill_cron.sql` | pg_cron 매시 자동 수집 스케줄 |

수집 방식(`blogs.collect`):
- **rss_full** — RSS 본문 포함(토스·배민·쿠팡·무신사·올리브영·AWS·NDS·네이버 D2/플레이스/DNA/페이) → 페이지 요청 없이 확보
- **rss_scrape** — RSS는 목록만 → 글 페이지에서 본문 추출(컬리·뱅크샐러드·강남언니)
- **listscrape** — RSS 없음 → sitemap 또는 목록에서 링크 수집 후 페이지 추출
  (오늘의집=sitemap·경로날짜, 카카오=sitemap·lastmod, 카카오페이=목록, 당근=careers목록·JSON-LD날짜)

**과거 글 백필(`since`)**: `?since=2025-06-01` 로 그 날짜 이후 글 전부 수집(블로그별 최대 60개).
- 깊은 소스(올리브영·오늘의집·강남언니·컬리·뱅크샐러드·**카카오**·**당근**) → 6월까지 도달
- **NDS** 는 WordPress `?paged=` 순회로 6월 도달(`PAGINATED_FEED`)
- 얕은 소스(토스·AWS·무신사·D2) → 피드에 최근치만 있어 최근 것만(기술적 한계)

> 소스별 본문·대표이미지 추출을 Node 실측으로 검증. UA 편차(오늘의집=브라우저, 카카오=크롤러)는 **본문 부족 시 반대 UA 자동 재시도**로 흡수. 배민은 Cloudflare 데이터센터 IP 차단으로 서버 수집 불가(유료 프록시 필요).

---

## 1단계 — 스키마 생성

Supabase 대시보드 **SQL Editor** 에서 `distill_schema.sql` 전체를 붙여넣고 **Run**.

- **단독 실행 가능** — `users`(프로필) 테이블 + 가입 자동 프로필 트리거까지 포함하므로 `setup_all.sql` 없이도 동작합니다. 기존 `setup_all.sql` 을 이미 실행했더라도 `create if not exists` 라 충돌 없음.
- 재실행 안전(idempotent). users·8개 테이블·RLS·블로그 18개 시드가 만들어집니다.
- ⚠️ **익명 로그인 사용 시**: 대시보드 **Authentication > Providers > Anonymous** 를 켜야 트리거가 프로필을 생성합니다(스터디앱과 동일).
- 확인: `select key, name, collect from public.blogs order by key;` → 18행.

## 2단계 — collect 함수 배포

로컬 터미널(프로젝트 루트 = `miran/study-app`)에서:

```bash
# 최초 1회: CLI 로그인 & 링크
supabase login
supabase link --project-ref qripaoexmfcyrrdbcbfl

# 함수 배포 (collect 는 SUPABASE_URL/SERVICE_ROLE_KEY 를 자동 주입받아 별도 시크릿 불필요)
supabase functions deploy collect
```

## 3단계 — 첫 수집(백필) 실행

바로 채워보려면 함수를 수동 호출합니다(대시보드 **Edge Functions > collect > Invoke** 또는 curl).

```bash
# 전체 블로그, 블로그별 신규 최대 8건
curl -i -X POST "https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/collect" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" -d '{}'

# 특정 블로그만(문제 진단/재시도)
curl -s -X POST ".../functions/v1/collect" -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" -d '{"blog":"kakao"}'
```

응답 예: `{"ok":true,"inserted":37,"report":[{"blog":"toss","found":12,"inserted":5}, ...]}`

- 확인: `select blog_id, title, topic, og_image is not null as has_img from public.articles order by created_at desc limit 20;`
- 처음엔 소스별 최신 ~12건이 2~3회 호출에 걸쳐 채워집니다(이미 있는 글은 자동 skip).

## 4단계 — 자동 수집 스케줄(pg_cron)

`distill_cron.sql` 을 엽니다.

1. **서비스 롤 키 저장(한 번만)** — 파일의 2번 주석 블록에서 `<SERVICE_ROLE_KEY>` 를 실제 키(대시보드 Settings > API > `service_role`)로 바꿔 그 한 줄만 먼저 Run.
2. 나머지 전체를 Run → `distill-collect-hourly` 잡이 **매시 정각** collect 를 호출(블로그별 신규 최대 5건).
3. 확인: `select jobname, schedule, active from cron.job;`

---

## 데이터 모델 요약

- `blogs` — 수집 소스(18개). `collect` 로 수집 방식 결정.
- `articles` — 수집된 글. `body`(문단 `\n` 구분 평문 — 앱이 문장 단위 하이라이트 앵커로 사용), `og_image`, `topic`, `tags[]`, `summary`, `ai_summaries`(온디맨드 캐시).
- `opinions` — 사용자의 인사이트(`insight` jsonb: core/quote/interpretation/apply/similar/questions).
- `opinion_comments` — 인사이트에 대한 토론(대댓글).
- `article_highlights` — 원문 문장 하이라이트(`sentence_index` 앵커).
- `article_bookmarks` / `reactions`(좋아요) / `user_topics`(관심 주제) — 개인화.

**접근 정책(RLS)**: blogs·articles 는 로그인 사용자 읽기·서버(service_role)만 쓰기. opinions/comments/highlights 는 모두 읽기·본인만 쓰기. bookmarks/reactions/user_topics 는 본인 것만.

---

## 트러블슈팅

| 증상 | 원인/조치 |
|---|---|
| 특정 블로그 `inserted:0`, `skipped>0` | 본문 200자 미만이라 스킵됨. `{"blog":"키"}` 로 단독 호출해 report 확인. |
| 특정 블로그 `error` | 사이트 개편으로 피드/셀렉터 변경. rss_url 또는 `collect/index.ts` 의 `LISTSCRAPE` 조정 필요. |
| cron 이 안 돎 | `select * from cron.job_run_details order by start_time desc;` 와 `net._http_response` 확인. 키 미저장이 흔한 원인. |
| topic 이 null | 분류 키워드 미매칭. 홈/전체엔 노출되나 주제 피드에는 안 뜸. `classify.ts` 키워드 보강으로 개선(선택). |

## 다음 단계 (Phase B~)

백엔드 완료 후 화면 재구성: **B** 홈+글상세 → **C** 피드/토론 → **D** 검색/마이 (`DESIGN_GUIDE.md` 기준).
