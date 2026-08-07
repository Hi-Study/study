import ogs from "open-graph-scraper";

export type ExtractedMetadata = {
  title: string;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  authorName: string | null;
  siteName: string | null;
};

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
  const { error, result } = await ogs({
    url,
    fetchOptions: { headers: { "user-agent": BROWSER_USER_AGENT } },
    timeout: 10000,
  });

  if (error || !result) {
    return { title: url, thumbnailUrl: null, publishedAt: null, authorName: null, siteName: null };
  }

  const publishedAtRaw =
    result.articlePublishedTime ?? result.ogDate ?? null;

  return {
    title: result.ogTitle ?? result.twitterTitle ?? url,
    thumbnailUrl: result.ogImage?.[0]?.url ?? null,
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
    authorName: result.articleAuthor ?? result.ogSiteName ?? null,
    siteName: result.ogSiteName ?? null,
  };
}
