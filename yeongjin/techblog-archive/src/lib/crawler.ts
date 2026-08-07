import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { extractFullContent, extractFromRssContent } from "@/lib/readability";
import { guessCategory } from "@/lib/category";
import { generateSummaryForPost } from "@/lib/ai/summarize";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type FeedItem = { "content:encoded"?: string };

const parser: Parser<Record<string, unknown>, FeedItem> = new Parser({
  headers: {
    "user-agent": BROWSER_USER_AGENT,
    // rss-parser의 기본 Accept는 'application/rss+xml'로 너무 엄격해 Atom만 제공하는
    // 사이트(네이버 D2 등)에서 406을 유발한다. 폭넓게 허용하도록 덮어쓴다.
    accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
  },
  timeout: 15000,
  customFields: { item: ["content:encoded"] },
});

export type CrawlResult = {
  company: string;
  fetched: number;
  created: number;
  skipped: number;
  errors: string[];
};

// 3.1 자동 수집 — RSS/Atom 폴링, 신규 글 감지, 중복 방지, 비동기 AI 요약 큐잉
export async function crawlAllCompanies(): Promise<CrawlResult[]> {
  const companies = await prisma.company.findMany({
    where: { rssUrl: { not: null } },
  });

  const results: CrawlResult[] = [];
  for (const company of companies) {
    results.push(await crawlCompany(company.id, company.name, company.rssUrl!));
  }
  return results;
}

export async function crawlCompany(companyId: string, companyName: string, rssUrl: string): Promise<CrawlResult> {
  const result: CrawlResult = { company: companyName, fetched: 0, created: 0, skipped: 0, errors: [] };

  let feed;
  try {
    feed = await parser.parseURL(rssUrl);
  } catch (err) {
    result.errors.push(`RSS 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const items = feed.items ?? [];
  result.fetched = items.length;

  for (const item of items) {
    const originalUrl = item.link?.trim();
    if (!originalUrl) continue;

    const existing = await prisma.post.findUnique({ where: { originalUrl } });
    if (existing) {
      result.skipped += 1;
      continue;
    }

    try {
      let content;
      try {
        content = await extractFullContent(originalUrl);
      } catch (fetchErr) {
        // Medium 등 봇 차단 사이트 대응: RSS가 제공하는 content:encoded 전문으로 폴백
        const rawHtml = item["content:encoded"];
        if (!rawHtml) throw fetchErr;
        content = extractFromRssContent(rawHtml, originalUrl);
      }

      const title = item.title?.trim() || content.contentText.slice(0, 80);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;

      const post = await prisma.post.create({
        data: {
          title,
          originalUrl,
          companyId,
          authorName: item.creator ?? (item as { author?: string }).author ?? null,
          publishedAt,
          thumbnailUrl: (item.enclosure?.url as string | undefined) ?? null,
          contentHtml: content.contentHtml,
          contentText: content.contentText,
          contentHash: content.contentHash,
          category: guessCategory(title, content.contentText),
          sourceType: "AUTO_COLLECTED",
        },
      });

      result.created += 1;

      // 등록자를 기다리게 하지 않는 비동기 처리(수집 배치는 이미 백그라운드이므로 바로 await)
      await generateSummaryForPost(post.id);
    } catch (err) {
      result.errors.push(`${originalUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
