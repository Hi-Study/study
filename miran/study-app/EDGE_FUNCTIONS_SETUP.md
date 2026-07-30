# 서버 자동화 설정 가이드 (알림 · 링크 미리보기 · AI 요약)

앱 핵심 기능은 이것 없이도 다 돌아갑니다. 이건 **"자동으로 해주는 고급 기능"** 세팅이에요.
난이도 순으로 정리했습니다.

---

## 1) 즉시 알림 (댓글·답글·멤버 참여) — **가장 쉬움, SQL만 실행**
Edge Function 없이 DB 트리거로 동작합니다.

- **이미 0001~0003 SQL을 실행한 경우**: SQL Editor에서
  `supabase/migrations/0004_notification_triggers.sql` 내용만 붙여넣고 **Run**.
- **아직 안 한 경우**: `supabase/setup_all.sql`(0004 포함)을 통째로 실행.

이것만으로:
- 내 글/의견에 **댓글·답글**이 달리면 → 알림 생성
- 스터디에 **새 멤버가 참여**하면 → 기존 멤버에게 알림

> 확인: 앱에서 두 계정으로 한쪽이 글 쓰고 다른 쪽이 댓글 달면, 글쓴이 알림 탭에 뜹니다.

---

## 2) 링크 미리보기(OG) · AI 요약 · 스케줄 알림 — Edge Function 배포 필요

### 준비물
- **Supabase CLI** 설치: https://supabase.com/docs/guides/cli (또는 `npm i -g supabase`)
- 로그인: `supabase login` (브라우저로 인증)
- 프로젝트 연결: `supabase link --project-ref qripaoexmfcyrrdbcbfl`

### 배포
```bash
cd study-app
supabase functions deploy og-preview
supabase functions deploy summarize
supabase functions deploy notify-cron
```

### AI 요약용 무료 LLM 키 (summarize)
1. **Groq**(무료·고속) 콘솔에서 API 키 발급: https://console.groq.com/keys
2. 시크릿 등록:
   ```bash
   supabase secrets set LLM_API_KEY=gsk_여기에_키
   ```
   (Gemini/Cloudflare로 바꾸려면 `summarize/index.ts` 의 `summarizeText` 함수만 교체)

### 스케줄 알림(notify-cron) 자동 실행
미참여 토론·공유 주기 미달 알림을 주기적으로 생성합니다.
- Supabase 대시보드 → **Edge Functions → notify-cron → Schedules(Cron)** 에서
  예) 매일 21:00 (`0 21 * * *`) 로 등록.
- 또는 대시보드 → **Integrations → Cron** 에서 함수 URL을 주기 호출.

---

## 3) 이미지 업로드 저장소 (직접 작성 글 사진)
- 대시보드 → **Storage → New bucket** → 이름 `share-images`, **Public** 체크 → Create.
- (RLS를 엄격히 하려면 storage.objects 정책을 별도 구성 — 지금은 public read 로 충분)

---

## 요약: 지금 당장 할 수 있는 것 vs 나중
| 기능 | 필요 작업 | 난이도 |
|---|---|---|
| 댓글·답글·멤버 알림 | **SQL 0004 실행만** | ⭐ 쉬움 |
| 이미지 업로드 | Storage 버킷 생성 | ⭐ 쉬움 |
| 링크 미리보기·AI요약 | Edge Function 배포(+LLM 키) | ⭐⭐ 보통 |
| 미참여/주기 알림 | Edge Function 배포 + Cron 등록 | ⭐⭐ 보통 |
