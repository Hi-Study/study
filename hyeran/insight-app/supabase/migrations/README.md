# 마이그레이션 운영 방법

**SQL Editor에 붙여넣지 않습니다.** Supabase CLI 로 적용합니다.

```bash
npx supabase db push     # migrations/ 중 아직 적용 안 된 것만 실행
```

적용 이력은 원격 DB의 `supabase_migrations.schema_migrations` 테이블에 남습니다.
"이거 돌렸나?"는 아래로 확인합니다.

```bash
npx supabase migration list
```

## 파일명 규칙

`<14자리 타임스탬프>_<기존번호>_<이름>.sql`

CLI가 요구하는 형식은 앞의 타임스탬프(=버전)뿐이지만, `기획_스펙.md`와
`schema.sql` 주석이 `[006]`, `마이그레이션 011` 처럼 **짧은 번호로 참조**하고 있어
번호를 이름에 남겼습니다. 새 파일도 이 규칙을 따르세요.

```bash
npx supabase migration new 013_이름     # → 20260901xxxxxx_013_이름.sql
```

## 001~011 은 CLI 도입 전에 SQL Editor로 수동 적용됐습니다

CLI 로 넘어갈 때 `migration repair --status applied` 로 **001~011 전부**를
"이미 적용됨" 표시해야 합니다. 이 과정을 건너뛰면 `db push` 가 이들을
**다시 실행**하는데, 005(카테고리 값 일괄 변경)와 010(알림 백필 insert)은
재실행 시 데이터가 망가집니다.

```bash
npx supabase migration repair --status applied \
  20260809205909 20260816000806 20260817224503 20260817224504 20260817230154 \
  20260826222215 20260826230630 20260826231308 20260826232547 20260827010822 \
  20260901120000
```

012(소스 확장)는 companies 를 API 로 먼저 넣어서 실제 반영은 끝났지만 SQL 은
실행하지 않았습니다. `on conflict do nothing` 이라 `db push` 로 그냥 흘려보내면 됩니다.

## schema.sql 은 마이그레이션이 아닙니다

`supabase/schema.sql` 은 최초 1회용 부트스트랩 스크립트이고 상단에 `drop table` 이
있습니다. `migrations/` 밖에 있으므로 `db push` 대상이 아닙니다.

⚠️ 남은 숙제: 이 베이스라인이 마이그레이션 이력에 없어서, 지금은 빈 프로젝트에
`db push` 만으로 스키마를 재현할 수 없습니다(001 이 이미 있는 테이블을 전제).
로컬 개발 환경이나 스테이징을 만들 때 schema.sql 을 `000_init` 마이그레이션으로
편입하는 작업이 선행돼야 합니다.
