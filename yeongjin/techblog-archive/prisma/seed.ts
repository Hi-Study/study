import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const COMPANIES = [
  {
    name: "네이버 D2",
    slug: "naver-d2",
    blogUrl: "https://d2.naver.com",
    rssUrl: "https://d2.naver.com/d2.atom",
  },
  {
    name: "컬리",
    slug: "kurly",
    blogUrl: "https://helloworld.kurly.com",
    rssUrl: "https://helloworld.kurly.com/rss.xml",
  },
  {
    name: "당근마켓",
    slug: "daangn",
    blogUrl: "https://medium.com/daangn",
    rssUrl: "https://medium.com/feed/daangn",
  },
  {
    name: "토스",
    slug: "toss",
    blogUrl: "https://toss.tech",
    rssUrl: "https://toss.tech/rss.xml",
  },
  {
    name: "우아한형제들",
    slug: "woowahan",
    blogUrl: "https://techblog.woowahan.com",
    rssUrl: "https://techblog.woowahan.com/feed/",
  },
  {
    name: "오늘의집",
    slug: "ohouse",
    blogUrl: "https://bucketplace-eng.oopy.io",
    // 공식 RSS 미제공 확인(2026-08 기준) — PRD 9.2 오픈 이슈, 추후 OG 스크레이핑 어댑터 필요
    rssUrl: null,
  },
] as const;

const KEYWORD_CHIPS = [
  { label: "대규모 트래픽, 어떻게 견디지?", category: "BACKEND" },
  { label: "장애는 어떻게 대응하지?", category: "BACKEND" },
  { label: "프론트엔드 성능, 어떻게 개선하지?", category: "FRONTEND" },
  { label: "디자인 시스템은 어떻게 만들지?", category: "FRONTEND" },
  { label: "데이터로 의사결정하는 법", category: "DATA_AI" },
  { label: "A/B 테스트, 어떻게 설계하지?", category: "DATA_AI" },
  { label: "배포는 어떻게 자동화하지?", category: "INFRA_DEVOPS" },
  { label: "인프라 비용은 어떻게 줄이지?", category: "INFRA_DEVOPS" },
  { label: "좋은 조직 문화는 어떻게 만들지?", category: "CULTURE_PROCESS" },
  { label: "애자일은 어떻게 실천하지?", category: "CULTURE_PROCESS" },
  { label: "사용자 피드백 어떻게 모으지?", category: "ETC" },
  { label: "사용성 테스트 어떻게 하지?", category: "ETC" },
] as const;

const DEMO_USERS = [
  { name: "주니어 개발자 A", email: "junior.a@team.dev" },
  { name: "시니어 개발자 B", email: "senior.b@team.dev" },
  { name: "PM 기획자 C", email: "pm.c@team.dev" },
  { name: "최영진", email: "yeongjin@team.dev" },
] as const;

const DEMO_PASSWORD = "password1234";

async function main() {
  for (const company of COMPANIES) {
    await prisma.company.upsert({
      where: { slug: company.slug },
      update: { name: company.name, blogUrl: company.blogUrl, rssUrl: company.rssUrl },
      create: company,
    });
  }

  for (const chip of KEYWORD_CHIPS) {
    await prisma.keywordChip.upsert({
      where: { label: chip.label },
      update: { category: chip.category },
      create: chip,
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }

  console.log("시드 완료:");
  console.log(`- 회사 ${COMPANIES.length}개`);
  console.log(`- 키워드 칩 ${KEYWORD_CHIPS.length}개`);
  console.log(`- 데모 유저 ${DEMO_USERS.length}명 (비밀번호: ${DEMO_PASSWORD})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
