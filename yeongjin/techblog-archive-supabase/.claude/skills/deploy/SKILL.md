---
name: deploy
description: Vercel 배포 전 점검이 필요할 때 자동으로 발동. "배포", "deploy", "vercel" 언급 시 사용.
---
1. `npm run build`, `npm run lint` 통과 확인
2. `.env.example` 대비 `.env.local`/Vercel 환경변수 누락 확인
3. feature flag 기본값이 CLAUDE.md와 일치하는지 확인
4. 사용자에게 배포 여부 확인 후 진행 (배포는 되돌리기 어려운 작업)
