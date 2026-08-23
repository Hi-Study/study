# API/데이터 컨벤션

- Supabase 테이블 접근은 RLS(Row Level Security)를 전제로 설계 — 클라이언트에서 직접 민감 데이터 접근 금지
- 신규 기능은 SCOPE.md의 feature flag 표를 따르고, 기본값 변경 시 CLAUDE.md도 함께 갱신
- URL 등록 시 중복 방지 로직 필수 (기존 URL 정규화 규칙 재사용)
- AI 요약/설명 API 키는 서버 사이드에서만 사용, 클라이언트에 노출 금지
