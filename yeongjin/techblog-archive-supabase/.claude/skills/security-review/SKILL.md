---
name: security-review
description: 인증, Supabase RLS, API 키, 사용자 입력 처리와 관련된 코드 변경이 있을 때 자동으로 발동. 로그인/회원가입/댓글/URL등록/AI API 호출 코드 수정 시 사용.
---
1. 변경된 파일에서 인증 흐름, RLS 정책, 입력 검증(Zod) 여부 확인
2. Supabase 키/Gemini·Groq API 키가 클라이언트 코드에 노출되지 않는지 확인
3. OWASP Top 10 관점에서 XSS/SQLi/권한 우회 가능성 점검
4. 발견사항을 요약 보고
