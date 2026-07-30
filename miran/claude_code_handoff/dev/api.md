# API / 엔드포인트 · 권한 · 누락되기 쉬운 로직

Supabase 기준. 대부분 CRUD는 **PostgREST 자동 엔드포인트 + RLS**로 처리하고, 서버 로직이 필요한 것만 **Edge Function**으로 둡니다. 아래는 화면 → 동작 → 필요한 것 매핑입니다.

## 1. 인증 / 프로필
| 동작 | 방식 | 권한 |
|---|---|---|
| 로그인 화면 | **없음** — 앱에 로그인/회원가입 화면 없음 | — |
| 사용자 식별 | Supabase **Anonymous Auth**(첫 실행 시 화면 없이 자동 생성) | 시스템 |
| 프로필 자동 생성 | `auth.users` insert 트리거 → `users` row(name '게스트') | 시스템 |
| 프로필 편집(이름·직급) | `update users` | 본인만 |
| 화면 설정(라이트/다크) | `update users.theme` | 본인만 |

> 프로필 미설정 기본값: 이름 = "게스트", 아바타 = 이름 첫 글자(색은 이름 해시 `hsl(h,42%,42%)`, 클라 계산). 직급 미입력 시 글/댓글 role = "멤버".

## 2. 스터디 / 멤버십 / 초대
| 동작 | 방식 | 권한 |
|---|---|---|
| 내 스터디 목록 | `select studies join study_members(user=me)` | 멤버 |
| 스터디 생성 | `insert studies`(랜덤 6자 코드) + owner 멤버십 insert (트랜잭션/RPC) | 로그인 |
| 코드로 참여 | RPC `join_by_code(code)` → 유효 확인 후 멤버십 insert(이미 참여면 안내+이동) | 로그인 |
| 코드 재발급 | `update studies.invite_code` (만료 없음, 재발급 시 기존 무효) | owner |
| 이름·소개·공유주기 변경 | `update studies` | owner |
| 멤버 강퇴 | `delete study_members` | owner |
| 방장 위임 | RPC `delegate_owner(study, target)` → `studies.owner_id` + 두 멤버 role 스왑 | owner |
| 스터디 나가기 | RPC `leave_study` → owner면 가장 오래된 멤버에 자동 위임 후 퇴장(마지막 멤버면 삭제) | 본인 |
| 스터디 삭제 | `delete studies`(cascade) | owner |

> **확정 규칙:** ① 코드 참여 RPC: 유효성 확인, **이미 참여 중이면 "이미 참여 중" 안내 후 해당 스터디로 이동**(에러 아님). ② 코드는 **만료 없음** — 재발급 시에만 기존 코드 무효. ③ **방장 나가기 = 가장 오래된 멤버(joined_at 최소)에 자동 위임** 후 퇴장, 마지막 멤버면 스터디 삭제. ④ 랜덤 코드 충돌 시 재시도 루프.

## 3. 공유 글 (달력 / 이번 주)
| 동작 | 방식 | 권한 |
|---|---|---|
| 날짜/요일별 목록(무한 스크롤) | `select shares where study & (date|dow)` order by `created_at desc`, keyset 커서 | 멤버 |
| 링크 공유 등록 | `insert shares(kind='link', url, note, day)` → 서버가 OG 채움 | 멤버 |
| 직접 작성 등록 | `insert shares(kind='text', title, body, day)` + 이미지 첨부(Storage → `image_urls`) | 멤버 |
| 상세 | `select share + comments + likes` | 멤버 |
| 좋아요 토글 | `insert/delete likes(target_type='share')` | 본인 |
| **OG 프리뷰** | **Edge Function `og-preview(url)`** → title/description/image 파싱 후 저장 | 멤버 |
| **AI 요약** | **Edge Function `summarize(share_id)`** → 원문 fetch + LLM 요약 | 멤버 |

> **AI 요약 — 무료 구성:** ① 원문은 서버(Edge Function)에서 fetch(브라우저 CORS 불가) → Readability로 본문 추출. ② 요약 LLM은 **무료 티어** 중 택1: **Google Gemini API**(월 무료 쿼터) · **Groq**(무료·고속) · **Cloudflare Workers AI**(무료 티어). ③ 결과를 캐시(요약 컬럼)해 재요청 무료. **한계:** 로그인/페이월·JS렌더·봇차단 페이지는 원문 확보 실패 → **제목·메모 기반 폴백 요약**(프로토타입도 이 방식). 무료 티어 rate limit 유의.

> **누락 주의:** ① 링크 원문은 **클라에서 못 가져옴(CORS)** → 반드시 서버(og-preview/summarize). ② AI 요약은 원문 확보 실패 대비 **제목·메모 기반 폴백**. ③ 최신 등록순 정렬. ④ URL 정규화·도메인 추출은 서버에서(주소 텍스트는 UI 비노출).

## 4. 토론
| 동작 | 방식 | 권한 |
|---|---|---|
| 주차별 목록(월 이동·검색) | `select discussions where study & week_start in month` | 멤버 |
| 토론 생성(링크/직접) | `insert discussions(kind, week_start, title, body/url)` | 멤버 |
| 상세(여는 글+스레드) | `select discussion + comments(tree) + likes` | 멤버 |
| 의견/답글 작성 | `insert comments(target_type='discussion', parent_id?)` | 멤버 |
| 좋아요 토글(여는 글·의견) | `insert/delete likes(target_type 'discussion'|'comment')` | 본인 |
| 결론 고정 | `update discussions.conclusion_comment_id` | owner |
| 정렬(등록순/좋아요순) | 쿼리 `order by created_at` ↔ `like_count desc` | 멤버 |

> **누락 주의:** ① 대댓글은 `parent_id` + `quote`(인용 원문 스냅샷). ② 결론 지정/해제 토글, 지정 시 해당 의견 강조. ③ 미참여 판정(이번 주 active 토론에 내 comment 없음)은 알림·배지 공용.

## 5. 알림
| type | 트리거 | 대상 |
|---|---|---|
| `discussion_pending` | 이번 주 active 토론에 내 의견 없음 | 각 멤버 |
| `cadence` | 공유 주기 미달(주기 종료 시점) | 각 멤버 |
| `comment` / `reply` | 내 글/의견에 댓글·답글 | 작성자 |
| `member_joined` | 새 멤버 참여 | 스터디 멤버 |

- **스케줄 알림**(pending·cadence)은 **Edge Function `notify-cron`**(pg_cron/Scheduled) 로 주기 계산 후 `notifications` insert + **Expo Push**.
- 즉시 알림(comment/reply/joined)은 insert 트리거 또는 Realtime.

> **확정 정책:** 토론 알림은 스터디 **전원**에게 보냅니다(전원 참여 전제 — @태그 방식 아님). 따라서 `comment_mentions` 테이블은 불필요.

## 6. 대시보드(마이페이지)
- 참여 스터디 수 / 내 공유 수 / 내 의견 수 / 미참여 수 — 집계 쿼리 or `dashboard_stats` 뷰.

## 확정된 정책 (구현 기준)
- **폼 검증**: 필수값·URL 형식·길이 제한 기본 검증(클라+서버 이중).
- **페이지네이션**: 공유 글·댓글 무한 스크롤(keyset).
- **이미지 업로드**: 직접 작성 글에만 허용(Storage). 링크는 OG 이미지.
- **신고/차단**: 별도 신고 없음. 중재는 **방장의 글/댓글 삭제 권한**으로.

## 아직 정의 안 된 것(추후 검토)
- 오프라인/낙관적 업데이트 충돌 처리.
- 푸시 권한 거부 시 인앱 알림 폴백.
