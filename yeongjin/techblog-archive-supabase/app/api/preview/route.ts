import { previewRequestSchema } from "@/lib/schemas/article";
import ogs from "open-graph-scraper";
import { NextResponse } from "next/server";

type PreviewResult = {
  title: string;
  company: string;
  thumbnailUrl: string | null;
  description: string | null;
};

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const match = html.match(re) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"));
  return match?.[1] ?? null;
}

// open-graph-scraper가 일부 사이트(WAF/봇 차단)에서 403을 받는 경우를 대비한 직접 fetch 폴백.
async function fetchOgManually(url: string, signal: AbortSignal): Promise<PreviewResult | null> {
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const titleTag = html.match(/<title>([^<]*)<\/title>/i)?.[1];

  return {
    title: extractMeta(html, "og:title") || titleTag || hostname,
    company: extractMeta(html, "og:site_name") || hostname,
    thumbnailUrl: extractMeta(html, "og:image"),
    description: extractMeta(html, "og:description"),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = previewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  const { url } = parsed.data;
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  // Vercel Hobby 플랜은 API Route 기본 timeout이 10초라 그 안에서 끝내도록 8초로 제한한다.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const { result } = await ogs({ url, fetchOptions: { signal: controller.signal } });
    clearTimeout(timeout);
    return NextResponse.json({
      title: result.ogTitle || result.twitterTitle || hostname,
      company: result.ogSiteName || hostname,
      thumbnailUrl: result.ogImage?.[0]?.url ?? null,
      description: result.ogDescription ?? null,
    });
  } catch {
    // open-graph-scraper 실패(403, 타임아웃, OG 태그 없음 등) 시 직접 fetch로 한 번 더 시도한다.
    try {
      const manual = await fetchOgManually(url, controller.signal);
      clearTimeout(timeout);
      if (manual) return NextResponse.json(manual);
    } catch {
      // 아래 최종 폴백으로 넘어간다.
    }
    clearTimeout(timeout);
    return NextResponse.json({
      title: hostname,
      company: hostname,
      thumbnailUrl: null,
      description: null,
      fallback: true,
    });
  }
}
