// distill 내 단어장(user_words) — 본문에서 어려운 단어를 저장하면 AI 가 뜻을 채운다.
//   저장(createWord)은 즉시 insert 로 끝내고, 뜻풀이(defineWord)는 뒤이어 비동기로 채운다
//   → 저장할 때 3~4초 기다리지 않게. 뜻이 채워지면 qk.words 무효화로 화면 갱신.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface UserWordArticleLite {
  id: string;
  title: string;
}

export interface UserWordRow {
  id: string;
  user_id: string;
  article_id: string | null;
  term: string;
  reading: string | null;
  definition: string | null;
  context: string | null;
  created_at: string;
  article: UserWordArticleLite | null;
}

const WORD_SELECT = "*, article:articles(id, title)";

// ---- raw ----
export async function listMyWords(uid: string): Promise<UserWordRow[]> {
  const { data, error } = await supabase
    .from("user_words")
    .select(WORD_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserWordRow[];
}

export interface CreateWordInput {
  term: string;
  context?: string | null;
  articleId?: string | null;
}

/**
 * 단어 저장(insert 만) — 뜻은 채우지 않는다. 이미 저장한 단어면 기존 id 를 그대로 돌려준다.
 * 반환: 저장/기존 단어의 id (실패 시 예외).
 */
export async function createWord(uid: string, input: CreateWordInput): Promise<string> {
  const { data, error } = await supabase
    .from("user_words")
    .insert({
      user_id: uid,
      term: input.term,
      context: input.context ?? null,
      article_id: input.articleId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // unique(user_id, term) 위반 → 이미 저장된 단어. 기존 id 반환(재정의 스킵).
    if (error.code === "23505") {
      const { data: ex } = await supabase
        .from("user_words")
        .select("id")
        .eq("user_id", uid)
        .eq("term", input.term)
        .single();
      return ex?.id ?? "";
    }
    throw error;
  }
  return data.id;
}

/** AI 뜻풀이 요청 — summarize 엣지 함수가 term+context 로 뜻을 만들어 user_words.definition 에 저장. */
export async function defineWord(wordId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("summarize", {
    body: { word_id: wordId },
  });
  if (error) throw error;
  return (data as { definition?: string })?.definition ?? null;
}

export async function deleteWord(id: string): Promise<void> {
  const { error } = await supabase.from("user_words").delete().eq("id", id);
  if (error) throw error;
}

/** 단어(term) 한 개 조회 — 클릭 시 뜻풀이 표시용. */
export async function getWordByTerm(uid: string, term: string): Promise<UserWordRow | null> {
  const { data, error } = await supabase
    .from("user_words")
    .select(WORD_SELECT)
    .eq("user_id", uid)
    .eq("term", term)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as UserWordRow) ?? null;
}

/** 단어 뜻이 채워질 때까지 폴링(AI 뜻풀이는 비동기 생성). 뜻이 나오면 폴링 중단. */
export function useWordByTerm(term: string | null) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.words(uid), "term", term ?? ""] as const,
    queryFn: () => getWordByTerm(uid, term!),
    enabled: Boolean(uid && term),
    refetchInterval: (query) => (query.state.data?.definition ? false : 2500),
  });
}

// ---- hooks ----
export function useMyWords() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.words(uid),
    queryFn: () => listMyWords(uid),
    enabled: Boolean(uid),
  });
}

/** 뜻풀이 채우기 — 성공하면 단어장 무효화(뜻이 화면에 뜸). */
export function useDefineWord() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wordId: string) => defineWord(wordId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.words(uid) }),
  });
}

/** 저장(즉시) → 목록 갱신 → 뜻풀이는 뒤이어 비동기로 채움. */
export function useCreateWord() {
  const uid = useUid();
  const qc = useQueryClient();
  const define = useDefineWord();
  return useMutation({
    mutationFn: (input: CreateWordInput) => createWord(uid, input),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: qk.words(uid) });
      if (id) define.mutate(id);
    },
  });
}

export function useDeleteWord() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWord(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.words(uid) }),
  });
}
