# Supabase 백엔드 (스키마 · RLS · RPC)

`dev/schema.md` · `dev/api.md` 를 마이그레이션 SQL 로 옮긴 것입니다. 화면 코드는 아직 없습니다.

## 마이그레이션 파일

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `migrations/0001_init_tables.sql` | 테이블 8개 + 인덱스 |
| 2 | `migrations/0002_functions_triggers.sql` | 멤버십 헬퍼, 프로필 트리거, 초대코드, RPC 5종 |
| 3 | `migrations/0003_rls_policies.sql` | RLS 활성화 + 정책 |

## 적용 방법 (택1)

**A. Supabase Studio (가장 간단)**
1. 프로젝트 생성 → SQL Editor.
2. `0001` → `0002` → `0003` 순서대로 붙여넣고 실행.

**B. Supabase CLI**
```bash
supabase link --project-ref <YOUR-REF>
supabase db push          # migrations/ 순서대로 적용
```

## 실행 후 필수 설정
1. **Authentication → Providers → Anonymous sign-ins = 켬**
   (앱은 로그인 화면 없이 익명 인증으로 사용자를 만듭니다.)
2. **Storage** — 직접 작성 글 이미지용 버킷 생성(예: `share-images`, public read).
   `shares.image_urls` 에 저장 경로/URL 을 넣습니다. (RLS 정책은 별도 구성)
3. **Edge Functions**(추후): `og-preview`, `summarize`, `notify-cron`.
   서버 함수는 `service_role` 로 동작하므로 RLS 를 우회해 `og_image` / `ai_summary`
   / `notifications` 를 채웁니다.

## RPC 요약 (PostgREST `rpc()` 로 호출)

| 함수 | 인자 | 반환 | 권한/정책 |
|---|---|---|---|
| `create_study` | `_name, _description, _cadence` | `uuid`(study id) | 인증. 코드 충돌 시 재시도 |
| `join_by_code` | `_code` | `jsonb {status, study_id}` | 이미 참여면 `already_member` 안내 |
| `delegate_owner` | `_study, _target` | `void` | 방장만 |
| `leave_study` | `_study` | `void` | 방장이면 최고참에 자동 위임 후 퇴장, 마지막이면 삭제 |
| `regenerate_invite_code` | `_study` | `char(6)` | 방장만. 기존 코드 무효 |

## dev/schema.md 대비 의도적 추가 (근거 포함)

RLS 를 안전·단순하게 강제하고 api.md 요구사항을 만족하기 위한 최소 추가입니다.

| 추가 | 위치 | 이유 |
|---|---|---|
| `comments.study_id` | 0001 | 댓글 하나로 멤버십 검사 가능(원 스키마는 `target_type/target_id` 만 있어 매 정책마다 target 을 되짚어야 함 → 재귀·성능 위험) |
| `likes.study_id` | 0001 | 동일 사유 — likes 만으로 멤버십 검사 |
| `shares.ai_summary` | 0001 | dev/api.md §3 "결과를 캐시(요약 컬럼)해 재요청 무료" 구현용 |
| `is_study_member()` / `is_study_owner()` | 0002 | RLS 공통 헬퍼. `SECURITY DEFINER` 로 `study_members` self-참조 재귀 회피 |

> 위 컬럼들은 앱 코드가 insert 시 함께 채워야 합니다(예: 댓글 작성 시 대상의
> `study_id` 를 같이 기록). 화면/훅 구현 단계에서 반영하세요.

## 주의 (RLS 설계 의도)
- **멤버 가입/탈퇴/위임/역할변경**은 직접 `insert/update` 정책을 두지 않고 **RPC로만**
  수행합니다(정책 부재 = 클라 직접 조작 차단, RPC 는 `SECURITY DEFINER` 로 우회).
- **owner 중재 삭제**: 신고 기능이 없으므로 owner 는 스터디 내 모든 `shares`/`comments`
  /`discussions` 를 delete 할 수 있습니다.
- **서버 전용 쓰기**(OG 파싱·AI 요약·스케줄 알림)는 Edge Function 의 `service_role`
  키로 수행 — RLS 를 우회하므로 별도 클라 정책이 필요 없습니다.
