import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { SummaryMode } from "@/lib/summary";
import type { DiscussionRow } from "@/types/tables";

export interface DiscussionAuthor {
  name: string;
  role_title: string | null;
}

/** 목록용 메타: 답글 수 + 내 참여 여부. */
export interface DiscussionWithMeta extends DiscussionRow {
  commentCount: number;
  participated: boolean;
}

export interface DiscussionDetailData extends DiscussionRow {
  author: DiscussionAuthor | null;
}

// ---- raw ----
/** 특정 월(월 이동)의 토론 목록. monthStart/monthEnd 는 'YYYY-MM-DD'. */
export interface DiscussionFilter {
  monthStart: string;
  monthEnd: string;
  search?: string;
  tag?: string;
  /** 다중 태그(하나라도 포함 — OR). */
  tags?: string[];
}

export async function listDiscussions(
  studyId: string,
  range: DiscussionFilter,
): Promise<DiscussionRow[]> {
  let q = supabase
    .from("discussions")
    .select("*")
    .eq("study_id", studyId)
    .gte("week_start", range.monthStart)
    .lte("week_start", range.monthEnd)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false });

  const search = range.search?.replace(/[,(){}%*]/g, " ").trim();
  if (search) {
    q = q.or(
      `title.ilike.%${search}%,prompt.ilike.%${search}%,body.ilike.%${search}%,tags.cs.{${search}}`,
    );
  }
  if (range.tag) q = q.contains("tags", [range.tag]);
  if (range.tags && range.tags.length > 0) q = q.overlaps("tags", range.tags);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** 스터디 토론에 쓰인 태그 목록(중복 제거·정렬) — 필터 칩용. */
export async function listDiscussionTags(studyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("discussions")
    .select("tags")
    .eq("study_id", studyId)
    .limit(1000);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) for (const t of (r.tags ?? [])) set.add(t);
  return [...set].sort();
}

export function useDiscussionTags(studyId: string) {
  return useQuery({
    queryKey: [...qk.discussions(studyId), "tags"] as const,
    queryFn: () => listDiscussionTags(studyId),
    enabled: Boolean(studyId),
  });
}

export async function getDiscussion(id: string): Promise<DiscussionRow> {
  const { data, error } = await supabase
    .from("discussions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** 상세용: 작성자(주최자) 조인. */
export async function getDiscussionDetail(
  id: string,
): Promise<DiscussionDetailData> {
  const { data, error } = await supabase
    .from("discussions")
    .select("*, author:users(name, role_title)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as DiscussionDetailData;
}

/** 목록 + 메타(답글 수·내 참여 여부). */
export async function listDiscussionsWithMeta(
  studyId: string,
  range: DiscussionFilter,
  uid: string,
): Promise<DiscussionWithMeta[]> {
  const rows = await listDiscussions(studyId, range);
  const ids = rows.map((r) => r.id);
  const countMap: Record<string, number> = {};
  const mine = new Set<string>();

  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("comments")
      .select("target_id, author_id")
      .eq("target_type", "discussion")
      .in("target_id", ids);
    if (error) throw error;
    for (const c of data ?? []) {
      countMap[c.target_id] = (countMap[c.target_id] ?? 0) + 1;
      if (c.author_id === uid) mine.add(c.target_id);
    }
  }

  return rows.map((r) => ({
    ...r,
    commentCount: countMap[r.id] ?? 0,
    participated: mine.has(r.id),
  }));
}

export interface CreateDiscussionInput {
  studyId: string;
  title: string;
  weekLabel: string;
  weekStart: string;
  kind: "link" | "text";
  prompt?: string;
  body?: string;
  url?: string;
  tags?: string[];
}

export async function createDiscussion(
  uid: string,
  input: CreateDiscussionInput,
): Promise<DiscussionRow> {
  const { data, error } = await supabase
    .from("discussions")
    .insert({
      study_id: input.studyId,
      author_id: uid,
      title: input.title,
      week_label: input.weekLabel,
      week_start: input.weekStart,
      kind: input.kind,
      prompt: input.prompt ?? null,
      body: input.body ?? null,
      url: input.url ?? null,
      tags: input.tags ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;

  // 링크 토론이면 원문/미리보기를 서버가 채움(공유 글과 동일). 실패해도 등록은 성공.
  if (input.kind === "link" && input.url) {
    supabase.functions
      .invoke("og-preview", { body: { discussion_id: data.id, url: input.url } })
      .catch(() => undefined);
  }

  return data;
}

/** 방장 결론 고정/해제 토글 (commentId=null 이면 해제). */
export async function setConclusion(
  discussionId: string,
  commentId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("discussions")
    .update({ conclusion_comment_id: commentId })
    .eq("id", discussionId);
  if (error) throw error;
}

export async function deleteDiscussion(id: string): Promise<void> {
  const { error } = await supabase.from("discussions").delete().eq("id", id);
  if (error) throw error;
}

export interface DiscussionEditPatch {
  title?: string;
  prompt?: string | null;
  body?: string | null;
  tags?: string[];
}

export async function updateDiscussion(
  id: string,
  patch: DiscussionEditPatch,
): Promise<void> {
  const { error } = await supabase.from("discussions").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useDiscussions(
  studyId: string,
  range: DiscussionFilter,
) {
  return useQuery({
    queryKey: [...qk.discussions(studyId), range] as const,
    queryFn: () => listDiscussions(studyId, range),
    enabled: Boolean(studyId),
  });
}

export function useDiscussion(id: string) {
  return useQuery({
    queryKey: qk.discussion(id),
    queryFn: () => getDiscussionDetail(id),
    enabled: Boolean(id),
  });
}

export function useDiscussionsWithMeta(
  studyId: string,
  range: DiscussionFilter,
  opts?: { enabled?: boolean },
) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.discussions(studyId), "meta", range] as const,
    queryFn: () => listDiscussionsWithMeta(studyId, range, uid),
    enabled: Boolean(studyId) && (opts?.enabled ?? true),
  });
}

export function useCreateDiscussion(studyId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateDiscussionInput, "studyId">) =>
      createDiscussion(uid, { ...input, studyId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discussions(studyId) }),
  });
}

export function useDeleteDiscussion(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscussion,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discussions(studyId) }),
  });
}

export function useUpdateDiscussion(studyId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DiscussionEditPatch) => updateDiscussion(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.discussion(id) });
      qc.invalidateQueries({ queryKey: qk.discussions(studyId) });
    },
  });
}

/** 토론 주제+여는 글 요약(모드별) → discussions.ai_summaries[mode]. */
export async function requestDiscussionContentSummary(
  discussionId: string,
  mode: SummaryMode,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { discussion_id: discussionId, target: "content", mode },
  });
  if (error) throw error;
  return (data as { summary?: string })?.summary ?? null;
}

/** 토론 결과(의견+결론) 요약 → discussions.ai_summary. */
export async function requestDiscussionResultSummary(discussionId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { discussion_id: discussionId, target: "result" },
  });
  if (error) throw error;
  return (data as { ai_summary?: string })?.ai_summary ?? null;
}

export function useRequestDiscussionContentSummary(discussionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: SummaryMode) => requestDiscussionContentSummary(discussionId, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discussion(discussionId) }),
  });
}

export function useRequestDiscussionResultSummary(discussionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestDiscussionResultSummary(discussionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discussion(discussionId) }),
  });
}

/** 토론 링크 원문 본문/미리보기 불러오기(og-preview, discussion_id). 상세 진입 시 자동 로드. */
export async function fetchDiscussionArticle(discussionId: string, url: string): Promise<void> {
  const { error } = await supabase.functions.invoke("og-preview", {
    body: { discussion_id: discussionId, url },
  });
  if (error) throw error;
}

export function useFetchDiscussionArticle(discussionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => fetchDiscussionArticle(discussionId, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.discussion(discussionId) }),
  });
}

export function useSetConclusion(discussionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string | null) =>
      setConclusion(discussionId, commentId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.discussion(discussionId) }),
  });
}
