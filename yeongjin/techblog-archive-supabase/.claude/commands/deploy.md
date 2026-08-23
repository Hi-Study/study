배포 전 점검 후 Vercel에 배포한다.

1. `npm run build`로 빌드 오류 확인
2. `npm run lint` 통과 확인
3. 환경변수(.env.example 대비 .env.local) 누락 확인
4. 문제 없으면 배포 진행 여부를 사용자에게 확인 후 진행
