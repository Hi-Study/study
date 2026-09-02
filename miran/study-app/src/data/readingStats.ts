// distill 읽기 통계 — 연속 읽기 배지(벌칙 없음) · 이번 달 누적 · 직군 배지 · 약한 영역.
//
// ⚠️ 연속(streak)은 **끊겨도 0 을 보여주지 않는다.** 0 을 노출하는 순간 벌칙이 되고,
//    "이번 주는 글렀다"가 되어 오히려 이탈 이유가 된다. 화면은 streak>0 일 때만 불꽃을 띄우고
//    누적(이번 달 N일)은 항상 남겨서 잃는 게 없게 만든다.
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { JobRole } from "@/types/database";

export interface ReadingStats {
  /** 연속 읽은 날 수. 0 이면 화면에서 불꽃을 숨긴다(0 을 쓰지 않는다). */
  streakDays: number;
  /** 이번 달 글을 읽은 날 수 */
  monthDays: number;
  /** 이번 달 읽은 글 수 */
  monthReads: number;
  /** 이번 달 남긴 인사이트 수 */
  monthOpinions: number;
}

const EMPTY_STATS: ReadingStats = {
  streakDays: 0,
  monthDays: 0,
  monthReads: 0,
  monthOpinions: 0,
};

// ---- raw ----

export async function getReadingStats(uid: string): Promise<ReadingStats> {
  const { data, error } = await supabase.rpc("my_reading_stats", { p_user_id: uid });
  if (error) throw error;
  const row = (data ?? [])[0] as
    | { streak_days: number; month_days: number; month_reads: number; month_opinions: number }
    | undefined;
  if (!row) return { ...EMPTY_STATS };
  return {
    streakDays: Number(row.streak_days ?? 0),
    monthDays: Number(row.month_days ?? 0),
    monthReads: Number(row.month_reads ?? 0),
    monthOpinions: Number(row.month_opinions ?? 0),
  };
}

export interface ReaderRoleCount {
  jobRole: JobRole;
  count: number;
}

/**
 * 이 글을 읽은 사람들의 직무 분포 — "기획자 12명이 이 글을 읽었어요".
 * 들어와서 개발자만 보이면 비개발자는 바로 나간다. 같은 직군의 존재를 보여주는 게 목적.
 */
export async function getArticleReaderRoles(articleId: string): Promise<ReaderRoleCount[]> {
  const { data, error } = await supabase.rpc("article_reader_roles", {
    p_article_id: articleId,
  });
  if (error) throw error;
  return ((data ?? []) as { job_role: JobRole; cnt: number }[]).map((r) => ({
    jobRole: r.job_role,
    count: Number(r.cnt),
  }));
}

export interface WeakDomain {
  domain: string;
  count: number;
}

/** 내가 자주 막히는 영역 — 단어를 누른 횟수를 도메인별로 합친 것. */
export async function getMyWeakDomains(uid: string): Promise<WeakDomain[]> {
  const { data, error } = await supabase.rpc("my_weak_domains", { p_user_id: uid });
  if (error) throw error;
  return ((data ?? []) as { domain: string; cnt: number }[]).map((r) => ({
    domain: r.domain,
    count: Number(r.cnt),
  }));
}

// ---- hooks ----

export function useReadingStats() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.readingStats(uid),
    queryFn: () => getReadingStats(uid),
    enabled: Boolean(uid),
    staleTime: 60_000,
  });
}

export function useArticleReaderRoles(articleId: string) {
  return useQuery({
    queryKey: qk.readerRoles(articleId),
    queryFn: () => getArticleReaderRoles(articleId),
    enabled: Boolean(articleId),
    staleTime: 60_000,
  });
}

export function useMyWeakDomains() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.weakDomains(uid),
    queryFn: () => getMyWeakDomains(uid),
    enabled: Boolean(uid),
    staleTime: 60_000,
  });
}
