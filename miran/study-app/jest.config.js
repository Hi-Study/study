/** Jest 설정 — Expo RN 프리셋 + '@/' 경로 alias. */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // supabase 함수형 목업 등 변환이 필요한 패키지 허용.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*|@tanstack/.*|lucide-react-native))",
  ],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
};
