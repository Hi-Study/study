/**
 * 공용 — 글 저장소(Supabase Postgres). 글 한 건 = 수집 원문 + 상태(포함/제외/대기) + 분석·가이드·분류 결과.
 * 스키마: supabase/schema.sql. 원문 전체가 들어 있어 RLS 로 막아 두고, 서버의 service_role 키로만 읽고 쓴다.
 * 이 파일은 서버(페이지·API·스크립트)에서만 쓴다 — 클라이언트 컴포넌트에서 import 하지 않는다.
 *
 * 2026-10-08 전에는 로컬 SQLite(data/app.db)였다. 옮긴 기록: scripts/run/migrate-to-supabase.mts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Item, Key } from "./list-ops";
import type { ArticleRow, ArticleStatus, Learning, OnboardingStatus, ReadingGuide, UserPreferences } from "./types";

const g = globalThis as unknown as { __sb?: SupabaseClient };

export function sb(): SupabaseClient {
  if (g.__sb) return g.__sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 을 확인해 주세요.");
  g.__sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return g.__sb;
}

type Raw = {
  id: number;
  company_id: string;
  title: string;
  url: string;
  published_at: string;
  content_html?: string;
  status: ArticleStatus;
  exclusion_reason: string | null;
  learning: Learning | null;
  reading_guide: ReadingGuide | null;
  thumbnail_url: string | null;
};

/** 목록 화면은 원문(content_html)이 필요 없다 — 빼고 가져와 전송량을 줄인다 */
const LIST_COLS = "id, company_id, title, url, published_at, status, exclusion_reason, learning, reading_guide, thumbnail_url";
const FULL_COLS = `${LIST_COLS}, content_html`;

function toRow(r: Raw): ArticleRow {
  return {
    id: r.id,
    companyId: r.company_id,
    title: r.title,
    url: r.url,
    publishedAt: new Date(r.published_at).toISOString(),
    contentHtml: r.content_html ?? "",
    status: r.status,
    exclusionReason: r.exclusion_reason,
    learning: r.learning,
    guide: r.reading_guide,
    thumbnail: r.thumbnail_url || null,
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}
/** 목록 결과 — 비어 있으면 [] */
function list<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? [];
}

/** opts.content: 원문까지 가져온다(분석·재분류 스크립트용). 화면 목록은 기본값(원문 없음) */
export async function listArticles(status: ArticleStatus, opts: { content?: boolean } = {}): Promise<ArticleRow[]> {
  const rows = list(
    await sb()
      .from("articles")
      .select(opts.content ? FULL_COLS : LIST_COLS)
      .eq("status", status)
      .order("published_at", { ascending: false })
      .returns<Raw[]>(),
  );
  return rows.map(toRow);
}

export async function getArticle(id: number): Promise<ArticleRow | null> {
  if (!Number.isFinite(id)) return null;
  const r = check(await sb().from("articles").select(FULL_COLS).eq("id", id).maybeSingle<Raw>());
  return r ? toRow(r) : null;
}

export async function getArticleIdByUrl(url: string): Promise<number | null> {
  const r = check(await sb().from("articles").select("id").eq("url", url).maybeSingle<{ id: number }>());
  return r?.id ?? null;
}

/**
 * 분석·가이드 전체를 JSON.stringify 해서 검색하면 스키마 키 이름("problem", "terms" 등)까지
 * 검색 대상이 되고, 영문 단어 안의 부분 문자열("AI" ⊂ "domain"/"detail"/"container")도 걸린다.
 * 그래서 실제로 사람이 쓴 문장·단어만 모아 검색 텍스트를 만든다 — 원문 그대로 발췌한 근거 문장(originalExcerpt)은
 * 빼서 노이즈를 더 줄인다.
 */
function learningText(l: Learning | null): string {
  if (!l) return "";
  const parts: (string | undefined)[] = [
    l.cardHeadline,
    l.hook,
    ...l.tags,
    l.conclusion,
    l.before,
    l.after,
    ...l.productPatterns,
    ...l.plannerQuestions,
    ...l.quickView.summary,
    ...l.quickView.whyItMatters,
    ...l.quickView.keywords,
    ...l.problem.items.flatMap((i) => [i.title, i.description]),
    ...l.technology.flatMap((t) => [t.name, t.simpleExplanation, t.plannerExplanation]),
    ...l.experienceImpact.flatMap((e) => [e.technology, e.capability, e.uxImpact, e.description]),
    ...l.discussionQuestions.flatMap((d) => [d.question, ...d.options]),
    l.problemCard?.title,
    l.problemCard?.summary,
    l.overview?.what,
    l.overview?.why,
    l.overview?.actions,
    l.overview?.results,
    ...(l.overview?.takeaways ?? []),
    ...(l.concepts ?? []).flatMap((c) => [c.term, c.what, c.why]),
    ...(l.tools ?? []).flatMap((t) => [t.name, t.description]),
  ];
  return parts.filter(Boolean).join(" ");
}

function guideText(g: ReadingGuide | null): string {
  if (!g) return "";
  const parts: (string | undefined)[] = [
    g.lead.what,
    g.lead.why,
    g.lead.how,
    g.lead.soWhat,
    ...g.points,
    ...g.sections.flatMap((s) => [s.question, s.problem, ...s.paras, s.outcome, ...s.terms]),
    ...g.terms.flatMap((t) => [t.term, t.plain]),
  ];
  return parts.filter(Boolean).join(" ");
}

/** 영문·숫자로만 된 검색어는 단어 경계로 찾는다 — "AI" 가 "domain"/"detail" 안에서 걸리지 않게 */
const ASCII_WORD = /^[a-z0-9+#.]+$/i;
function textMatches(haystack: string, needle: string): boolean {
  if (ASCII_WORD.test(needle)) {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${esc}\\b`, "i").test(haystack);
  }
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** 제목·회사·분석·가이드에서 찾는다. 포함 글이 수십~수백 건이라 서버에서 걸러도 충분하다 */
export async function searchArticles(q: string): Promise<ArticleRow[]> {
  return (await listArticles("included")).filter((a) =>
    [a.title, a.companyId, learningText(a.learning), guideText(a.guide)].some((s) => textMatches(s, q)),
  );
}

export async function countByStatus(): Promise<Record<ArticleStatus, number>> {
  const out: Record<ArticleStatus, number> = { pending: 0, included: 0, excluded: 0 };
  await Promise.all(
    (Object.keys(out) as ArticleStatus[]).map(async (s) => {
      const res = await sb().from("articles").select("id", { count: "exact", head: true }).eq("status", s);
      if (res.error) throw new Error(`Supabase: ${res.error.message}`);
      out[s] = res.count ?? 0;
    }),
  );
  return out;
}

/** 회사별·상태별 건수 (npm run report) */
export async function countByCompany(): Promise<{ company_id: string; status: ArticleStatus }[]> {
  return list(await sb().from("articles").select("company_id, status").returns<{ company_id: string; status: ArticleStatus }[]>());
}

/** 같은 URL 이 이미 있으면 넣지 않는다. 새로 넣었으면 id, 아니면 null */
export async function insertArticle(a: {
  companyId: string;
  title: string;
  url: string;
  publishedAt: string;
  contentHtml: string;
}): Promise<number | null> {
  const rows = list(
    await sb()
      .from("articles")
      .upsert(
        { company_id: a.companyId, title: a.title, url: a.url, published_at: a.publishedAt, content_html: a.contentHtml },
        { onConflict: "url", ignoreDuplicates: true },
      )
      .select("id")
      .returns<{ id: number }[]>(),
  );
  return rows[0]?.id ?? null;
}

async function update(id: number, patch: Record<string, unknown>) {
  check(await sb().from("articles").update(patch).eq("id", id));
}

export const updateContent = (id: number, html: string) => update(id, { content_html: html });
export const markExcluded = (id: number, reason: string) =>
  update(id, { status: "excluded", exclusion_reason: reason, learning: null });
export const markIncluded = (id: number, learning: Learning) =>
  update(id, { status: "included", exclusion_reason: null, learning });
export const saveGuide = (id: number, guide: ReadingGuide | null) => update(id, { reading_guide: guide });
/** "" 는 "찾아봤지만 없음" — 다시 찾지 않는다 */
export const setThumbnail = (id: number, url: string) => update(id, { thumbnail_url: url });

export async function articlesWithoutThumbnailCheck(): Promise<{ id: number; url: string; content_html: string }[]> {
  return list(
    await sb()
      .from("articles")
      .select("id, url, content_html")
      .is("thumbnail_url", null)
      .order("published_at", { ascending: false })
      .returns<{ id: number; url: string; content_html: string }[]>(),
  );
}

/** 같은 회사 글 n개 이상이 똑같은 이미지를 쓰면 사이트 기본 이미지로 보고 비운다 */
export async function clearSharedThumbnails(min = 3): Promise<{ companyId: string; url: string; n: number }[]> {
  const rows = list(
    await sb()
      .from("articles")
      .select("company_id, thumbnail_url")
      .neq("thumbnail_url", "")
      .not("thumbnail_url", "is", null)
      .returns<{ company_id: string; thumbnail_url: string }[]>(),
  );
  const count = new Map<string, number>();
  for (const r of rows) count.set(`${r.company_id}\n${r.thumbnail_url}`, (count.get(`${r.company_id}\n${r.thumbnail_url}`) ?? 0) + 1);
  const out: { companyId: string; url: string; n: number }[] = [];
  for (const [k, n] of count) {
    if (n < min) continue;
    const [companyId, url] = k.split("\n");
    check(await sb().from("articles").update({ thumbnail_url: "" }).eq("company_id", companyId).eq("thumbnail_url", url));
    out.push({ companyId, url, n });
  }
  return out;
}

/* ───────── 자동 실행(예약 작업)용 ───────── */

/** 자동 처리할 대기 글 — 최신 글부터, 실패를 반복한 글(시도 3회 이상)은 건너뛴다 */
export async function pendingForAuto(limit: number): Promise<{ id: number; attempts: number }[]> {
  return list(
    await sb()
      .from("articles")
      .select("id, attempts")
      .eq("status", "pending")
      .lt("attempts", 3)
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<{ id: number; attempts: number }[]>(),
  );
}
export const bumpAttempts = (id: number, attempts: number) => update(id, { attempts: attempts + 1 });

/** 상세 요약 v2 가 빈 포함 글 — 최신 글부터, 3번 실패한 글(learning.detailError.attempts)은 건너뛴다. 원문까지 가져온다 */
export async function missingDetail(limit: number): Promise<ArticleRow[]> {
  const rows = list(
    await sb()
      .from("articles")
      .select(FULL_COLS)
      .eq("status", "included")
      .is("learning->detailPromptVersion", null)
      .order("published_at", { ascending: false })
      .limit(limit * 3)
      .returns<Raw[]>(),
  );
  return rows
    .map(toRow)
    .filter((a) => a.learning && (a.learning.detailError?.attempts ?? 0) < 3)
    .slice(0, limit);
}

/** 실행이 겹치지 않게 잠근다. 잡았으면 true */
export async function tryLock(name: string, seconds: number): Promise<boolean> {
  return check(await sb().rpc("try_lock", { lock_name: name, seconds })) === true;
}
export async function releaseLock(name: string) {
  check(await sb().rpc("release_lock", { lock_name: name }));
}

/* ── 내 목록(북마크·읽은 글·최근 검색어) — 계정마다 한 줄씩. 스키마: supabase/schema.sql 의 user_lists ── */

/** 표가 아직 없으면(SQL 을 안 돌림) null — 화면은 예전처럼 브라우저에만 저장한다 */
export async function getUserLists(userId: string): Promise<Partial<Record<Key, Item[]>> | null> {
  const res = await sb().from("user_lists").select("key, items").eq("user_id", userId).returns<{ key: Key; items: Item[] }[]>();
  if (res.error) {
    console.error("[user_lists] 읽기 실패", res.error.message);
    return null;
  }
  return Object.fromEntries((res.data ?? []).map((r) => [r.key, r.items]));
}

export async function getUserList(userId: string, key: Key): Promise<Item[]> {
  const r = check(
    await sb().from("user_lists").select("items").eq("user_id", userId).eq("key", key).maybeSingle<{ items: Item[] }>(),
  );
  return r?.items ?? [];
}

export async function saveUserList(userId: string, key: Key, items: Item[]) {
  check(
    await sb()
      .from("user_lists")
      .upsert({ user_id: userId, key, items, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }),
  );
}

/* ── 직군별 개인화 온보딩 — 계정마다 한 줄씩. 스키마: supabase/schema.sql 의 user_preferences ── */

type PreferencesRaw = {
  role: string | null;
  interests: string[];
  onboarding_status: OnboardingStatus;
  onboarding_version: number;
  onboarding_completed_at: string | null;
};

/** 표가 아직 없으면(SQL 을 안 돌림) null — 화면은 온보딩을 매번 새로 보여주지 않고 조용히 건너뛴다 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const res = await sb()
    .from("user_preferences")
    .select("role, interests, onboarding_status, onboarding_version, onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle<PreferencesRaw>();
  if (res.error) {
    console.error("[user_preferences] 읽기 실패", res.error.message);
    return null;
  }
  if (!res.data) return null;
  return {
    role: res.data.role,
    interests: res.data.interests ?? [],
    onboardingStatus: res.data.onboarding_status,
    onboardingVersion: res.data.onboarding_version,
    onboardingCompletedAt: res.data.onboarding_completed_at,
  };
}

export async function saveUserPreferences(
  userId: string,
  patch: Partial<{ role: string; interests: string[]; onboardingStatus: OnboardingStatus }>,
): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.interests !== undefined) row.interests = patch.interests;
  if (patch.onboardingStatus !== undefined) {
    row.onboarding_status = patch.onboardingStatus;
    if (patch.onboardingStatus === "completed") row.onboarding_completed_at = new Date().toISOString();
  }
  check(await sb().from("user_preferences").upsert(row, { onConflict: "user_id" }));
}
