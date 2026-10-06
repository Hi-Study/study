/** 0단계 — 글 썸네일 찾기. 기준 문서: docs/01_분류기준.md 0단계 */
import * as cheerio from "cheerio";
import { articlesWithoutThumbnailCheck, db, setThumbnail } from "../shared/db";

const UA = "Mozilla/5.0 (techblog-perspective local demo)";
/** 추적 픽셀·아이콘 등 썸네일이 될 수 없는 이미지 */
const NOT_THUMB = /medium\.com\/_\/stat|\/stat\?|pixel|spacer|favicon|emoji|\.svg(\?|$)|gravatar|avatar/i;

function firstContentImage(html: string): string {
  const $ = cheerio.load(html);
  for (const el of $("img").toArray()) {
    const src = $(el).attr("src") ?? "";
    if (src.startsWith("http") && !NOT_THUMB.test(src)) return src;
  }
  return "";
}

/** 글 페이지의 og:image → twitter:image → 본문 첫 이미지 */
export async function findThumbnail(url: string, contentHtml: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    const $ = cheerio.load(await res.text());
    const og =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      "";
    if (og && !NOT_THUMB.test(og)) return new URL(og, res.url).toString();
  } catch {
    /* 페이지 실패 — 본문 이미지로 */
  }
  return firstContentImage(contentHtml);
}

/**
 * 썸네일이 아직 확인되지 않은 글을 채운다.
 * 같은 회사 글 여러 개가 똑같은 이미지를 쓰면 사이트 기본 이미지(로고 배너)라서 비운다 — 화면이 회사 로고·색으로 대신한다.
 */
export async function backfillThumbnails(log: (m: string) => void = () => {}) {
  const rows = articlesWithoutThumbnailCheck();
  let found = 0;
  for (const r of rows) {
    const t = await findThumbnail(r.url, r.content_html);
    setThumbnail(r.id, t);
    if (t) found++;
  }
  // 사이트 기본 이미지 걸러내기
  const dup = db()
    .prepare(
      `SELECT company_id, thumbnail_url, COUNT(*) n FROM articles
       WHERE thumbnail_url != '' GROUP BY company_id, thumbnail_url HAVING n >= 3`,
    )
    .all() as { company_id: string; thumbnail_url: string; n: number }[];
  for (const d of dup) {
    db().prepare("UPDATE articles SET thumbnail_url = '' WHERE company_id = ? AND thumbnail_url = ?").run(d.company_id, d.thumbnail_url);
    log(`  · ${d.company_id}: 글 ${d.n}개가 같은 이미지를 써서 기본 이미지로 보고 비움`);
  }
  log(`썸네일 확인 ${rows.length}건 · 찾음 ${found}건`);
}
