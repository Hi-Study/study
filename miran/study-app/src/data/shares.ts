import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { SummaryMode } from "@/lib/summary";
import type { Insight } from "@/lib/insight";
import type { ShareRow } from "@/types/tables";

const PAGE_SIZE = 20;

export interface ShareFilter {
  /** 특정 날짜(캘린더) 필터 — 'YYYY-MM-DD' */
  date?: string;
  /** 요일(이번 주) 필터 — 0=월 … 6=일 */
  dayOfWeek?: number;
}

interface Cursor {
  created_at: string;
  id: string;
}

// ---- raw: 무한 스크롤(keyset) ----
export async function fetchSharesPage(
  studyId: string,
  filter: ShareFilter,
  cursor: Cursor | null,
): Promise<{ rows: ShareRow[]; nextCursor: Cursor | null }> {
  let q = supabase
    .from("shares")
    .select("*")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (filter.date) q = q.eq("shared_date", filter.date);
  if (filter.dayOfWeek != null) q = q.eq("day_of_week", filter.dayOfWeek);
  if (cursor) {
    // (created_at, id) 튜플 keyset — 동시각 tie-break 포함.
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === PAGE_SIZE && last
      ? { created_at: last.created_at, id: last.id }
      : null;
  return { rows, nextCursor };
}

export async function getShare(shareId: string): Promise<ShareRow> {
  const { data, error } = await supabase
    .from("shares")
    .select("*")
    .eq("id", shareId)
    .single();
  if (error) throw error;
  return data;
}

export interface CreateLinkShareInput {
  studyId: string;
  url: string;
  note?: string;
  title: string;
  dayOfWeek: number;
  sharedDate: string;
  tags?: string[];
  insight?: Insight | null;
}

export async function createLinkShare(
  uid: string,
  input: CreateLinkShareInput,
): Promise<ShareRow> {
  const { data, error } = await supabase
    .from("shares")
    .insert({
      study_id: input.studyId,
      author_id: uid,
      kind: "link",
      url: input.url,
      note: input.note ?? null,
      title: input.title,
      day_of_week: input.dayOfWeek,
      shared_date: input.sharedDate,
      tags: input.tags ?? [],
      insight: input.insight ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // OG 메타는 서버(Edge Function)가 채움 — 실패해도 등록 자체는 성공 처리.
  supabase.functions
    .invoke("og-preview", { body: { share_id: data.id, url: input.url } })
    .catch(() => undefined);

  return data;
}

export interface CreateTextShareInput {
  studyId: string;
  title: string;
  body: string;
  dayOfWeek: number;
  sharedDate: string;
  imageUrls?: string[];
  tags?: string[];
  insight?: Insight | null;
}

export async function createTextShare(
  uid: string,
  input: CreateTextShareInput,
): Promise<ShareRow> {
  const { data, error } = await supabase
    .from("shares")
    .insert({
      study_id: input.studyId,
      author_id: uid,
      kind: "text",
      title: input.title,
      body: input.body,
      day_of_week: input.dayOfWeek,
      shared_date: input.sharedDate,
      image_urls: input.imageUrls ?? null,
      tags: input.tags ?? [],
      insight: input.insight ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShare(shareId: string): Promise<void> {
  const { error } = await supabase.from("shares").delete().eq("id", shareId);
  if (error) throw error;
}

export interface ShareEditPatch {
  title?: string;
  note?: string | null;
  body?: string | null;
  tags?: string[];
  insight?: Insight | null;
  /** 링크 글에서 URL 을 바꾸면 원문/요약을 새로 수집한다. */
  url?: string | null;
}

export async function updateShare(id: string, patch: ShareEditPatch): Promise<void> {
  // URL 변경 시: 기존 원문/요약 캐시를 비워 새 주소 기준으로 다시 채우게 한다.
  const full = patch.url
    ? { ...patch, article_text: null, ai_summary: null, ai_summaries: {} }
    : patch;
  const { error } = await supabase.from("shares").update(full).eq("id", id);
  if (error) throw error;
  if (patch.url) {
    supabase.functions
      .invoke("og-preview", { body: { share_id: id, url: patch.url } })
      .catch(() => undefined);
  }
}

/** AI 요약 요청(모드별) → shares.ai_summaries[mode] 캐시 후 요약 반환. */
export async function requestSummary(
  shareId: string,
  mode: SummaryMode,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { share_id: shareId, mode },
  });
  if (error) throw error;
  return (data as { summary?: string })?.summary ?? null;
}

/** 링크 원문 본문/미리보기 불러오기(og-preview 호출). 상세 진입 시 본문 자동 로드용. */
export async function fetchArticlePreview(shareId: string, url: string): Promise<void> {
  const { error } = await supabase.functions.invoke("og-preview", {
    body: { share_id: shareId, url },
  });
  if (error) throw error;
}

export function useFetchArticle(shareId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => fetchArticlePreview(shareId, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.share(shareId) }),
  });
}

/**
 * 폰에서 추출한 원문을 DB 에 캐시(작성자만 성공 — RLS 로 비작성자는 0행, 에러 아님).
 * 성공 시 모든 멤버가 서버 캐시본을 공유하고 AI 요약(summarize)도 이 본문을 쓴다.
 */
export async function cacheArticleFromDevice(
  shareId: string,
  patch: { article_text: string; og_description?: string | null; og_image?: string | null; source?: string | null },
): Promise<void> {
  await supabase.from("shares").update(patch).eq("id", shareId);
}

// ---- hooks ----
export function useSharesInfinite(studyId: string, filter: ShareFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.shares(studyId), filter] as const,
    queryFn: ({ pageParam }) =>
      fetchSharesPage(studyId, filter, pageParam as Cursor | null),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(studyId),
  });
}

export function useShare(shareId: string) {
  return useQuery({
    queryKey: qk.share(shareId),
    queryFn: () => getShare(shareId),
    enabled: Boolean(shareId),
  });
}

export function useCreateShare(studyId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: qk.shares(studyId) });
  return {
    link: useMutation({
      mutationFn: (input: Omit<CreateLinkShareInput, "studyId">) =>
        createLinkShare(uid, { ...input, studyId }),
      onSuccess: invalidate,
    }),
    text: useMutation({
      mutationFn: (input: Omit<CreateTextShareInput, "studyId">) =>
        createTextShare(uid, { ...input, studyId }),
      onSuccess: invalidate,
    }),
  };
}

export function useDeleteShare(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteShare,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shares(studyId) }),
  });
}

export function useUpdateShare(studyId: string, shareId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ShareEditPatch) => updateShare(shareId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.share(shareId) });
      qc.invalidateQueries({ queryKey: qk.shares(studyId) });
    },
  });
}

export function useRequestSummary(shareId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: SummaryMode) => requestSummary(shareId, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.share(shareId) }),
  });
}

// ---- 날짜 기반 조회(달력/이번 주 카드) ----
export interface ShareAuthor {
  name: string;
  role_title: string | null;
}

export interface ShareWithMeta extends ShareRow {
  author: ShareAuthor | null;
  likeCount: number;
  commentCount: number;
}

/** 공유 글 목록의 좋아요·댓글 수를 배치로 집계. (polymorphic 관계라 임베드 불가) */
async function fetchShareCounts(
  ids: string[],
): Promise<{ likes: Record<string, number>; comments: Record<string, number> }> {
  if (ids.length === 0) return { likes: {}, comments: {} };
  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("likes").select("target_id").eq("target_type", "share").in("target_id", ids),
    supabase.from("comments").select("target_id").eq("target_type", "share").in("target_id", ids),
  ]);
  if (likesRes.error) throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const tally = (rows: { target_id: string }[]) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.target_id] = (acc[r.target_id] ?? 0) + 1;
      return acc;
    }, {});
  return {
    likes: tally(likesRes.data ?? []),
    comments: tally(commentsRes.data ?? []),
  };
}

/** 특정 날짜(shared_date)의 공유 글 — 작성자 + 좋아요/댓글 수 포함, 최신순. */
export async function listSharesByDate(
  studyId: string,
  dateISO: string,
): Promise<ShareWithMeta[]> {
  const { data, error } = await supabase
    .from("shares")
    .select("*, author:users!shares_author_id_fkey(name, role_title)")
    .eq("study_id", studyId)
    .eq("shared_date", dateISO)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as (ShareRow & {
    author: ShareAuthor | null;
  })[];
  const counts = await fetchShareCounts(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    likeCount: counts.likes[r.id] ?? 0,
    commentCount: counts.comments[r.id] ?? 0,
  }));
}

/** 공유 글 상세 — 작성자 + 좋아요/댓글 수 포함. */
export async function getShareDetail(shareId: string): Promise<ShareWithMeta> {
  const { data, error } = await supabase
    .from("shares")
    .select("*, author:users!shares_author_id_fkey(name, role_title)")
    .eq("id", shareId)
    .single();
  if (error) throw error;
  const row = data as unknown as ShareRow & { author: ShareAuthor | null };
  const counts = await fetchShareCounts([row.id]);
  return {
    ...row,
    likeCount: counts.likes[row.id] ?? 0,
    commentCount: counts.comments[row.id] ?? 0,
  };
}

export function useShareDetail(shareId: string) {
  return useQuery({
    queryKey: qk.share(shareId),
    queryFn: () => getShareDetail(shareId),
    enabled: Boolean(shareId),
  });
}

/** 공유 피드 필터 — 제목/내용 검색 + 날짜 범위 + 태그. */
export interface ShareFeedFilter {
  search?: string;
  tag?: string;
  /** 다중 태그(하나라도 포함 — OR). */
  tags?: string[];
  /** 종류 필터(링크/직접작성). */
  kind?: "link" | "text";
  dateFrom?: string;
  dateTo?: string;
}

/** 공유 피드(무한 스크롤) — 전체 글을 최신순으로, 작성자 + 좋아요/댓글 수 포함. */
export async function listSharesFeed(
  studyId: string,
  cursor: Cursor | null,
  filter: ShareFeedFilter = {},
): Promise<{ rows: ShareWithMeta[]; nextCursor: Cursor | null }> {
  let q = supabase
    .from("shares")
    .select("*, author:users!shares_author_id_fkey(name, role_title)")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }
  const search = filter.search?.replace(/[,(){}%*]/g, " ").trim();
  if (search)
    q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%,note.ilike.%${search}%,tags.cs.{${search}}`);
  if (filter.tag) q = q.contains("tags", [filter.tag]);
  if (filter.tags && filter.tags.length > 0) q = q.overlaps("tags", filter.tags);
  if (filter.kind) q = q.eq("kind", filter.kind);
  if (filter.dateFrom) q = q.gte("shared_date", filter.dateFrom);
  if (filter.dateTo) q = q.lte("shared_date", filter.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as (ShareRow & { author: ShareAuthor | null })[];
  const counts = await fetchShareCounts(rows.map((r) => r.id));
  const withMeta: ShareWithMeta[] = rows.map((r) => ({
    ...r,
    likeCount: counts.likes[r.id] ?? 0,
    commentCount: counts.comments[r.id] ?? 0,
  }));
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === PAGE_SIZE && last ? { created_at: last.created_at, id: last.id } : null;
  return { rows: withMeta, nextCursor };
}

export function useSharesFeed(studyId: string, filter: ShareFeedFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.shares(studyId), "feed", filter] as const,
    queryFn: ({ pageParam }) => listSharesFeed(studyId, pageParam as Cursor | null, filter),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(studyId),
  });
}

/** 스터디 공유 글에 쓰인 태그 목록(중복 제거·정렬) — 필터 칩용. */
export async function listShareTags(studyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("shares")
    .select("tags")
    .eq("study_id", studyId)
    .limit(1000);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) for (const t of (r.tags ?? [])) set.add(t);
  return [...set].sort();
}

export function useShareTags(studyId: string) {
  return useQuery({
    queryKey: [...qk.shares(studyId), "tags"] as const,
    queryFn: () => listShareTags(studyId),
    enabled: Boolean(studyId),
  });
}

/** 기간 내 날짜별 공유 글 개수(달력 점·주간 카운트용). */
export async function listShareDatesInRange(
  studyId: string,
  startISO: string,
  endISO: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("shares")
    .select("shared_date")
    .eq("study_id", studyId)
    .gte("shared_date", startISO)
    .lte("shared_date", endISO);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    counts[r.shared_date] = (counts[r.shared_date] ?? 0) + 1;
  }
  return counts;
}

export function useSharesByDate(studyId: string, dateISO: string) {
  return useQuery({
    queryKey: [...qk.shares(studyId), "date", dateISO] as const,
    queryFn: () => listSharesByDate(studyId, dateISO),
    enabled: Boolean(studyId && dateISO),
  });
}

export function useShareDatesInRange(
  studyId: string,
  startISO: string,
  endISO: string,
) {
  return useQuery({
    queryKey: [...qk.shares(studyId), "range", startISO, endISO] as const,
    queryFn: () => listShareDatesInRange(studyId, startISO, endISO),
    enabled: Boolean(studyId && startISO && endISO),
  });
}
