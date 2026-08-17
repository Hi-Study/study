/** @type {import('next').NextConfig} */
const nextConfig = {
  // 서버에서만 쓰는 무거운 패키지는 번들하지 않고 런타임 require
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;
