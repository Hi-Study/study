# 테스트

- 별도 테스트 러너 미구성 상태 — 테스트 프레임워크 도입 전까지는 `npm run lint` + `npm run build`로 회귀 확인
- Supabase 관련 로직은 `.local-data`(DATA_BACKEND=local) 환경에서 우선 검증 후 실제 Supabase 프로젝트로 확인
- AI 연동(Gemini/Groq) 코드는 API 실패/한도초과 케이스를 반드시 수동 확인
