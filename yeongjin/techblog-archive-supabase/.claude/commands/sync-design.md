DESIGN.md(디자인 시스템 문서)을 기준으로 실제 코드를 동기화한다. 사용자가 DESIGN.md를 직접 고친 뒤 이 명령을 실행하는 걸 전제로 한다 — Claude Code는 파일 저장을 자동으로 감지하지 못하므로, 이 명령이 "저장하면 코드가 업데이트되는" 것의 실제 트리거다.

1. `DESIGN.md`를 읽고 5장 체크리스트에서 아직 `[ ]`(미완료)인 항목과, 2~4장 내용 중 실제 코드와 달라 보이는 부분(토큰 값, 컴포넌트 patterns, 화면 매핑)을 찾는다.
2. 아래 파일들을 실제 코드 기준으로 대조한다:
   - 토큰: `tailwind.config.ts`, `app/globals.css` — DESIGN.md 2장의 색상/반경/타이포 값과 다르면 DESIGN.md 쪽이 최신 의도이므로 코드를 맞춘다(단, 색상 근사치처럼 "팀 톤에 맞게 보정 필요"라고 명시된 값은 먼저 사용자에게 확인).
   - 공통 컴포넌트: `components/ui/*`, `components/filter-chip-row.tsx`, `components/empty-state.tsx`, `components/ai-summary-card.tsx`, `components/write-fab.tsx`, `components/bottom-nav.tsx` — DESIGN.md 3장 패턴과 실제 구현이 어긋나면 코드를 갱신한다.
   - 화면: `app/(app)/**/page.tsx` — DESIGN.md 4장 매핑표에 새로 추가된 화면/패턴이 있으면 해당 페이지에 적용한다.
3. 코드 변경 후 반드시 `npm run lint`와 `npm run build`로 회귀를 확인한다(`.claude/rules/testing.md`).
4. DESIGN.md 5장 체크리스트를 실제 반영 상태에 맞게 `[x]`/`[ ]` 갱신하고, 7장 변경 이력에 이번 변경을 한 줄로 추가한다.
5. 애매하거나 팀 의사결정이 필요한 항목(예: 새 컬러의 정확한 hex, 큰 IA 변경)은 코드를 바꾸지 말고 대신 "확인 필요" 목록으로 사용자에게 물어본다.
