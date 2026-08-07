# 테크 블로그 아카이빙 서비스

PRD 기준 MVP 구현체. 정본 문서: [`../테크블로그_아카이빙_서비스_PRD_1.md`](../테크블로그_아카이빙_서비스_PRD_1.md), 작업 규칙: [`../CLAUDE.md`](../CLAUDE.md)

- **배포 URL**: https://techblog-archive.vercel.app
- **데모 계정**: `yeongjin@team.dev` / `password1234` (그 외 `junior.a@team.dev`, `senior.b@team.dev`, `pm.c@team.dev`도 동일 비밀번호)

## 디자인

색상/타이포/라운드/그림자 토큰은 [Wanted Montage](https://github.com/wanteddev/montage-web) 디자인 시스템의 실제 값(`packages/wds-theme`)을 참고해 `src/app/globals.css`의 Tailwind 테마로 이식했다. `@wanteddev/wds` 컴포넌트 패키지 자체는 GitHub Packages(사설 레지스트리, `read:packages` 토큰 필요)로만 배포돼 직접 설치하지 못했고, 토큰만 가져와 기존 Tailwind 컴포넌트에 적용하는 방식으로 반영했다. Primary 컬러(`#0066FF`)와 Pretendard 폰트, `neutral-*` 스케일(Montage `coolNeutral`), elevation 그림자를 사용한다.

## 스택

- Next.js 16 (App Router, Turbopack, Server Actions)
- Prisma 7 (`@prisma/adapter-pg` 드라이버 어댑터) + Supabase Postgres
- NextAuth v5 (Credentials + JWT, 초대코드 없음)
- Gemini API (AI 요약) — 무료 티어, Groq 폴백 지원(키 설정 시)
- rss-parser + linkedom + `@mozilla/readability` + sanitize-html (RSS 자동수집 → 본문 추출 → XSS 새니타이징)

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채우기 (아래 참고)
npm run db:migrate     # 최초 1회: 스키마 마이그레이션
npm run db:seed        # 회사/키워드칩/데모유저 시드
npm run dev
```

`.env` 필수 값:

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | Postgres 연결 문자열. Supabase 기준 **Session pooler**(5432, 로컬/마이그레이션용) |
| `AUTH_SECRET` | `openssl rand -base64 32` 등으로 생성 |
| `AUTH_TRUST_HOST` | 로컬 `next start`/비-Vercel 배포 시 `"true"` 필요 (Vercel은 자동 처리) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey)에서 무료 발급 |
| `GROQ_API_KEY` | 선택. Gemini 실패 시 폴백 |
| `CRON_SECRET` | `/api/cron/collect` 보호용 임의 문자열 |

## RSS 자동수집 (3.1)

```bash
npm run collect          # 1회 즉시 실행 (로컬)
```

수집 대상 6개 회사 중 5개(네이버 D2·컬리·당근마켓·토스·우아한형제들)는 RSS 확인 완료. **오늘의집은 공식 RSS 미제공**이라 시드에 회사 정보만 있고 자동수집 대상에서 제외됨(PRD 9.2 오픈 이슈).

### 운영 환경에서 주기적으로 돌리기

PRD 3.1 확정 정책은 "5~15분 간격"이지만, **Vercel Hobby 플랜은 크론을 하루 1회로 제한**해서 `vercel.json`에 크론을 등록하지 않았다(등록 시 배포 자체가 실패함). 실시간에 가까운 주기를 유지하려면:

- **Vercel Pro로 업그레이드** 후 `vercel.json`에 `{"crons":[{"path":"/api/cron/collect","schedule":"*/10 * * * *"}]}` 추가, 또는
- **외부 스케줄러**(cron-job.org, GitHub Actions 등)가 5~15분마다 아래를 호출하도록 설정:
  ```
  GET https://techblog-archive.vercel.app/api/cron/collect
  Authorization: Bearer <CRON_SECRET>
  ```

## Vercel 배포

이미 `choiyoungjin9797-5878s-projects/techblog-archive` 프로젝트로 연결 및 배포되어 있다. 재배포:

```bash
vercel --prod
```

환경변수는 이미 Vercel 프로젝트(Production/Preview)에 등록되어 있음 (`vercel env ls`로 확인, `vercel env add`로 갱신). `DATABASE_URL`은 배포 환경에서 **Transaction pooler**(6543)를 사용한다 — 서버리스 인스턴스가 동시에 여러 개 뜰 수 있어 Session pooler(5432, 동시 세션 15개 제한)로는 금방 연결 한도를 초과하기 때문.

## MVP 범위에서 의도적으로 제외/단순화한 것

- **형광펜 + AI 쉬운 설명(3.8)**: PRD 8장에서 v1.1+로 명시되어 있어 미구현
- **관리자 권한**: 자동 수집 글의 관리자 숨김/삭제(3.4)는 미구현(관리자 역할 자체가 없음)
- **소프트 삭제 유예기간 배치**: 삭제는 소프트 삭제까지만 구현, 유예기간 경과 후 영구 삭제 배치는 없음 — 정확한 유예 일수가 PRD 9.2 오픈 이슈라 임의로 정하지 않음
- **오늘의집 자동수집**: 공식 RSS 미제공, OG 스크레이핑 어댑터는 추후 과제

## 알려진 제약

- RSS 원문 페이지를 직접 크롤링하는 경우 사이트가 봇을 차단하면(예: Medium 403) 실패한다. Medium은 RSS의 `content:encoded` 전문으로 폴백하도록 처리했지만, 다른 사이트가 막을 경우 해당 글은 건너뛴다.
