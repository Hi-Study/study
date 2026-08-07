import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { generateSummaryForPost } from "../src/lib/ai/summarize";

const PER_COMPANY = 5;

async function main() {
  const companies = await prisma.company.findMany();
  let done = 0;

  for (const company of companies) {
    const posts = await prisma.post.findMany({
      where: { companyId: company.id, summary: { status: { in: ["FAILED", "PENDING"] } } },
      take: PER_COMPANY,
      orderBy: { createdAt: "desc" },
    });

    for (const post of posts) {
      try {
        await generateSummaryForPost(post.id);
        done += 1;
        console.log(`[ok] ${company.name} - ${post.title}`);
      } catch (e) {
        console.log(`[fail] ${company.name} - ${post.title}: ${e instanceof Error ? e.message : e}`);
      }
      // 무료 티어 rate limit 보호
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`총 ${done}개 요약 생성 완료`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
