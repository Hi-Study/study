import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 회사 로고는 빌드 때 받아 public/logos 에 두고, 서버가 그 폴더를 읽어 있는 로고만 쓴다(core/0-collect/logos.ts).
  // 배포 서버(함수)에는 public 폴더가 자동으로 들어가지 않아서 직접 넣어 준다.
  outputFileTracingIncludes: {
    "/**": ["./public/logos/**/*"],
  },
};

export default nextConfig;
