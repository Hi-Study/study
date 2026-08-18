import { extractArticleBody } from "@/lib/content/extract-body";
import { insertCollectedArticle, listArticles } from "@/lib/db/articles";
import { listUserKeysFollowingCompany } from "@/lib/db/company-follows";
import { createNotification } from "@/lib/db/notifications";
import { summarizeArticle } from "@/lib/ai/summarize-article";
import { COLLECT_SINCE, RSS_SOURCES } from "@/lib/rss/sources";
import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000 });

type CollectResult = {
  company: string;
  found: number;
  inserted: number;
  skipped: number;
  error?: string;
};

// RSS 자동 수집(PRD v0.2 4.11) — 대상 기업 피드를 폴링해 신규 글만 저장한다.
// local-store 백엔드는 파일 락이 없어 순차 처리한다(articles route의 알림 발송과 동일한 이유).
export async function collectFromAllSources(): Promise<CollectResult[]> {
  const existingUrls = new Set((await listArticles()).map((a) => a.url));
  const results: CollectResult[] = [];

  for (const source of RSS_SOURCES) {
    const result: CollectResult = { company: source.company, found: 0, inserted: 0, skipped: 0 };
    try {
      const feed = await parser.parseURL(source.feedUrl);
      const items = feed.items ?? [];
      result.found = items.length;

      for (const item of items) {
        const url = item.link;
        if (!url) continue;
        if (existingUrls.has(url)) {
          result.skipped++;
          continue;
        }
        const publishedAt = item.isoDate ? new Date(item.isoDate) : null;
        if (publishedAt && publishedAt < COLLECT_SINCE) {
          result.skipped++;
          continue;
        }

        const extracted = await extractArticleBody(url);

        const { data, error } = await insertCollectedArticle({
          url,
          title: item.title ?? "(제목 없음)",
          company: source.company,
          category: "기타",
          tags: [],
          thumbnail_url: item.enclosure?.url ?? null,
          body_html: extracted?.html ?? null,
          body_byline: extracted?.byline ?? null,
        });
        existingUrls.add(url);

        if (error || !data) {
          result.skipped++;
          continue;
        }
        result.inserted++;

        await summarizeArticle(data.id).catch(() => {});

        const followerKeys = await listUserKeysFollowingCompany(source.company);
        for (const key of followerKeys) {
          await createNotification({
            userKey: key,
            type: "new_article",
            message: `좋아요한 기업 "${source.company}"에 새 글이 올라왔어요: ${data.title}`,
            articleId: data.id,
          });
        }
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : "피드를 가져오지 못했어요";
    }
    results.push(result);
  }

  return results;
}
