import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Supabase Session pooler는 동시 세션 수가 낮게 제한되어 있다(무료 티어 기준 15개).
// 서버리스 인스턴스마다 별도 풀이 열리므로 인스턴스당 풀 크기를 작게 유지한다.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 3 });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
