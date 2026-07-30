# 개발 워크플로우 (기능 단위 파이프라인)

이 프로젝트는 **기능(화면) 하나씩** 아래 루프로 진행합니다. 각 기능은 게이트를 통과해야 "완료"입니다.
사용자는 비개발자이므로 **테스트는 Claude(개발자)가 직접 자동으로 수행**합니다.

## 한 기능의 라이프사이클

```
①  스펙 확인        정본 문서에서 해당 화면 스펙 읽기
                    (design/README.md · dev/api.md · 프로토타입 *.jsx.txt)
        │
②  구현             화면 UI + 데이터 연결 + 상호작용을 "한 세트(vertical slice)"로 구현
                    - 데이터는 src/data/* 계층 통해서만
                    - 공용 컴포넌트(src/components) · 토큰(src/theme) 재사용
        │
③  검증 게이트  ◀── Claude 가 직접 실행 ─────────────────────────
        │           npm run typecheck   (타입 오류 0)
        │           npm test            (Jest 통과)
        │
        ├─ 실패 → ② 로 돌아가 수정 → ③ 재검증  (통과할 때까지 반복)
        │
④  커밋             게이트 통과 시 원자적 커밋(한국어 메시지)
        │
⑤  완료 보고        무엇을 만들었고, 무엇이 자동 검증됐고,
                    무엇이 "실제 폰/실서버 미확인"인지 정직하게 명시
```

## 테스트의 두 층위 (정직한 구분)

| 층위 | 방법 | 지금 자동화 | 담당 |
|---|---|---|---|
| **코드 검증** | `tsc` 타입체크 | ✅ | Claude |
| **연결 검증** | Jest + **Supabase mock** — 화면이 올바른 data 함수를 올바른 인자로 부르는지, 상태(로딩/에러/빈값)를 처리하는지 | ✅ | Claude |
| **실행 검증** | 실제 폰(Expo Go) + 실제 Supabase 에서 클릭 | ⛔ (Supabase 세팅 후) | 추후 사용자와 함께 |

> 지금 단계에서 "테스트 통과"는 **코드·연결 검증**을 의미합니다. 픽셀 단위 외형과 실제 DB 동작은
> Supabase 세팅 이후에만 확정되며, 그전까지는 "미확인"으로 명시합니다.

## 명령어

```bash
npm run typecheck   # 타입 오류 검사
npm test            # 전체 테스트
npm test -- <파일>  # 특정 테스트만
npm run test:watch  # 변경 감시 모드
```

## 커밋 규칙
- 기능 1개 = 게이트 통과 = 커밋 1개.
- 메시지: 한국어, 명령형. 예) `feat: 내 스터디 목록 화면 구현 및 데이터 연결`
- 되돌리기: 문제가 생기면 마지막 통과 커밋으로 `git restore` / `git reset` 가능.

## 진행 순서(화면)
1. 홈: MyStudies → CreateStudy → JoinStudy
2. 스터디 탭: StudyCalendar → Weekly
3. 공유 글: ShareDetail → CreateShare
4. 토론: DiscussionList → DiscussionDetail → CreateDiscussion
5. 마이페이지 군: MyPage → ProfileEdit → DisplaySettings → Members → StudyManage → Notifications
