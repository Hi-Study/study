/** 공용 — SQLite 저장소(data/app.db). 글 한 건 = 수집 원문 + 상태(포함/제외/대기) + 분석·가이드·분류 결과 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { ArticleRow, ArticleStatus, Learning, ReadingGuide } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const g = globalThis as unknown as { __db?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__db) return g.__db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT NOT NULL,
      content_html TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      exclusion_reason TEXT,
      learning_json TEXT,
      reading_guide_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, published_at);
  `);
  // v02: 대표 이미지(og:image) — 없으면 화면이 회사 로고·색으로 대신한다
  const cols = conn.prepare("PRAGMA table_info(articles)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "thumbnail_url")) conn.exec("ALTER TABLE articles ADD COLUMN thumbnail_url TEXT");
  g.__db = conn;
  return conn;
}

type Raw = {
  id: number;
  company_id: string;
  title: string;
  url: string;
  published_at: string;
  content_html: string;
  status: ArticleStatus;
  exclusion_reason: string | null;
  learning_json: string | null;
  reading_guide_json: string | null;
  thumbnail_url: string | null;
};

function toRow(r: Raw): ArticleRow {
  return {
    id: r.id,
    companyId: r.company_id,
    title: r.title,
    url: r.url,
    publishedAt: r.published_at,
    contentHtml: r.content_html,
    status: r.status,
    exclusionReason: r.exclusion_reason,
    learning: r.learning_json ? (JSON.parse(r.learning_json) as Learning) : null,
    guide: r.reading_guide_json ? (JSON.parse(r.reading_guide_json) as ReadingGuide) : null,
    thumbnail: r.thumbnail_url || null,
  };
}

/** "" 는 "찾아봤지만 없음" — 다시 찾지 않는다 */
export function setThumbnail(id: number, url: string) {
  db().prepare("UPDATE articles SET thumbnail_url = ? WHERE id = ?").run(url, id);
}

export function articlesWithoutThumbnailCheck(): { id: number; url: string; content_html: string }[] {
  return db()
    .prepare("SELECT id, url, content_html FROM articles WHERE thumbnail_url IS NULL ORDER BY published_at DESC")
    .all() as { id: number; url: string; content_html: string }[];
}

export function listArticles(status: ArticleStatus): ArticleRow[] {
  const rows = db()
    .prepare("SELECT * FROM articles WHERE status = ? ORDER BY published_at DESC")
    .all(status) as Raw[];
  return rows.map(toRow);
}

export function getArticle(id: number): ArticleRow | null {
  const r = db().prepare("SELECT * FROM articles WHERE id = ?").get(id) as Raw | undefined;
  return r ? toRow(r) : null;
}

export function getArticlesByIds(ids: number[]): ArticleRow[] {
  if (ids.length === 0) return [];
  const rows = db()
    .prepare(`SELECT * FROM articles WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Raw[];
  return rows.map(toRow);
}

/** title/hook/tags/company/learning_json 전체를 대상으로 하는 검색 */
export function searchArticles(q: string): ArticleRow[] {
  const like = `%${q}%`;
  const rows = db()
    .prepare(
      `SELECT * FROM articles WHERE status = 'included'
       AND (title LIKE ? OR company_id LIKE ? OR learning_json LIKE ? OR reading_guide_json LIKE ?)
       ORDER BY published_at DESC`,
    )
    .all(like, like, like, like) as Raw[];
  return rows.map(toRow);
}

export function countByStatus(): Record<ArticleStatus, number> {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM articles GROUP BY status").all() as {
    status: ArticleStatus;
    n: number;
  }[];
  const out: Record<ArticleStatus, number> = { pending: 0, included: 0, excluded: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export function insertArticle(a: {
  companyId: string;
  title: string;
  url: string;
  publishedAt: string;
  contentHtml: string;
}): number | null {
  const res = db()
    .prepare(
      `INSERT OR IGNORE INTO articles (company_id, title, url, published_at, content_html)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(a.companyId, a.title, a.url, a.publishedAt, a.contentHtml);
  return res.changes ? Number(res.lastInsertRowid) : null;
}

export function updateContent(id: number, html: string) {
  db().prepare("UPDATE articles SET content_html = ? WHERE id = ?").run(html, id);
}

export function markExcluded(id: number, reason: string) {
  db()
    .prepare("UPDATE articles SET status = 'excluded', exclusion_reason = ?, learning_json = NULL WHERE id = ?")
    .run(reason, id);
}

export function markIncluded(id: number, learning: Learning) {
  db()
    .prepare("UPDATE articles SET status = 'included', exclusion_reason = NULL, learning_json = ? WHERE id = ?")
    .run(JSON.stringify(learning), id);
}

export function saveGuide(id: number, guide: ReadingGuide | null) {
  db()
    .prepare("UPDATE articles SET reading_guide_json = ? WHERE id = ?")
    .run(guide ? JSON.stringify(guide) : null, id);
}
