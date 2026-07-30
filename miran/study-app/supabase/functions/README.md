# Edge Functions (Deno)

서버 로직이 필요한 것만 Edge Function 으로 둡니다. 나머지 CRUD 는 PostgREST + RLS.
모두 **스텁**입니다 — 계약(입출력)과 골격만 확정, 핵심 로직은 `TODO` 표시.

| 함수 | 트리거 | 하는 일 | 상태 |
|---|---|---|---|
| `og-preview` | 링크 공유 등록 후 클라가 invoke | 원문 fetch → OG 파싱 → `shares.og_image/og_description/source` 갱신 | 파싱 단순 스텁 |
| `summarize` | 공유 상세에서 요약 요청 | 원문 fetch → 무료 LLM 요약 → `shares.ai_summary` 캐시, 실패 시 제목·메모 폴백 | LLM 호출부 TODO |
| `notify-cron` | 스케줄(cron) | `discussion_pending`·`cadence` 판정 → `notifications` insert (+Expo Push) | 판정 로직 TODO |

## 배포
```bash
supabase functions deploy og-preview
supabase functions deploy summarize
supabase functions deploy notify-cron
```

## 시크릿 (service_role 및 LLM 키)
```bash
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 플랫폼이 자동 주입됩니다.
supabase secrets set LLM_API_KEY=...        # summarize 용 (Gemini/Groq/Cloudflare 택1)
```

## 스케줄 등록 (notify-cron)
- Dashboard > Edge Functions > 해당 함수 > Schedules 에 cron 등록, 또는
- `pg_cron` + `net.http_post` 로 함수 URL 을 주기 호출.

## 주의
- 서버 함수는 **service_role** 로 동작 → RLS 우회. 키가 유출되면 전체 데이터 접근이
  가능하므로 클라이언트 번들/깃에 절대 포함 금지.
- `notify-cron` 의 Expo Push 발송에는 사용자별 푸시 토큰 저장소가 필요합니다
  (예: `user_push_tokens(user_id, token)` 테이블 — 추후 마이그레이션에서 추가).
