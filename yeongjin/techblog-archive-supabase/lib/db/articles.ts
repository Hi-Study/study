import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

// DATA_BACKEND=local(기본): Supabase 없이 로컬 파일로 테스트한다.
// DATA_BACKEND=supabase: 실제 Supabase articles 테이블을 사용한다.
const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

export type ArticleRecord = {
  id: string;
  url: string;
  title: string;
  company: string;
  category: string;
  tags: string[];
  thumbnail_url: string | null;
  // 원문 본문 스냅샷(FEATURE_ORIGINAL_SNAPSHOT 확정) — 추출 실패 시 null, 이때는 원문 링크로만 대체한다.
  body_html: string | null;
  body_byline: string | null;
  // 자동 수집 글은 등록자가 없어 독후감을 나중에 채운다(PRD v0.2 4.11) — 그래서 nullable이다.
  impressive_part: string | null;
  apply_idea: string | null;
  discussion_question: string | null;
  source_type: "manual" | "auto";
  created_by: string | null;
  note_author: string | null;
  created_at: string;
  ai_problem: string | null;
  ai_solution: string | null;
  ai_takeaway: string | null;
  ai_status: "pending" | "ready" | "error" | null;
};

export type NewArticleInput = Omit<
  ArticleRecord,
  "id" | "created_at" | "ai_problem" | "ai_solution" | "ai_takeaway" | "ai_status"
>;

export async function listArticles(): Promise<ArticleRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as ArticleRecord[];
  }

  const items = await readCollection<ArticleRecord>("articles");
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getArticleById(id: string): Promise<ArticleRecord | null> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("articles").select("*").eq("id", id).single();
    return (data as ArticleRecord) ?? null;
  }

  const items = await readCollection<ArticleRecord>("articles");
  return items.find((a) => a.id === id) ?? null;
}

export async function searchArticles(query: {
  q?: string;
  category?: string;
  tag?: string;
  companies?: string[];
}): Promise<ArticleRecord[]> {
  const all = await listArticles();
  const q = query.q?.trim().toLowerCase();

  return all.filter((a) => {
    if (query.category && query.category !== "전체" && a.category !== query.category) {
      return false;
    }
    if (query.tag && !a.tags.includes(query.tag)) {
      return false;
    }
    if (query.companies && query.companies.length > 0 && !query.companies.includes(a.company)) {
      return false;
    }
    if (q) {
      const haystack = [a.title, a.company, a.category, ...a.tags].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function insertArticle(
  input: NewArticleInput,
): Promise<{ data?: ArticleRecord; error?: { code?: string; message: string } }> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("articles")
      .insert(input)
      .select("*")
      .single();
    if (error) return { error: { code: error.code, message: error.message } };
    return { data: data as ArticleRecord };
  }

  const items = await readCollection<ArticleRecord>("articles");
  if (items.some((a) => a.url === input.url)) {
    return { error: { code: "23505", message: "이미 등록된 글이에요" } };
  }

  const record: ArticleRecord = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ai_problem: null,
    ai_solution: null,
    ai_takeaway: null,
    ai_status: "pending",
  };
  items.push(record);
  await writeCollection("articles", items);
  return { data: record };
}

export type CollectedArticleInput = {
  url: string;
  title: string;
  company: string;
  category: string;
  tags: string[];
  thumbnail_url: string | null;
  body_html: string | null;
  body_byline: string | null;
};

// RSS 자동 수집(PRD v0.2 4.11) 전용 삽입 경로 — 독후감 없이 저장하고, 나중에 팀원이 채운다.
export async function insertCollectedArticle(
  input: CollectedArticleInput,
): Promise<{ data?: ArticleRecord; error?: { code?: string; message: string } }> {
  return insertArticle({
    ...input,
    impressive_part: null,
    apply_idea: null,
    discussion_question: null,
    source_type: "auto",
    created_by: null,
    note_author: null,
  });
}

export async function addNoteToArticle(
  id: string,
  note: {
    impressivePart: string;
    applyIdea: string;
    discussionQuestion: string;
    authorKey: string;
  },
): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase
      .from("articles")
      .update({
        impressive_part: note.impressivePart,
        apply_idea: note.applyIdea,
        discussion_question: note.discussionQuestion,
        note_author: note.authorKey,
      })
      .eq("id", id);
    return;
  }

  const items = await readCollection<ArticleRecord>("articles");
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    impressive_part: note.impressivePart,
    apply_idea: note.applyIdea,
    discussion_question: note.discussionQuestion,
    note_author: note.authorKey,
  };
  await writeCollection("articles", items);
}

export async function updateArticleBody(
  id: string,
  data: { html: string; byline: string | null },
): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase
      .from("articles")
      .update({ body_html: data.html, body_byline: data.byline })
      .eq("id", id);
    return;
  }

  const items = await readCollection<ArticleRecord>("articles");
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], body_html: data.html, body_byline: data.byline };
  await writeCollection("articles", items);
}

export async function updateArticleAiSummary(
  id: string,
  data: { problem: string; solution: string; takeaway: string; status: "ready" | "error" },
): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase
      .from("articles")
      .update({
        ai_problem: data.problem,
        ai_solution: data.solution,
        ai_takeaway: data.takeaway,
        ai_status: data.status,
      })
      .eq("id", id);
    return;
  }

  const items = await readCollection<ArticleRecord>("articles");
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    ai_problem: data.problem,
    ai_solution: data.solution,
    ai_takeaway: data.takeaway,
    ai_status: data.status,
  };
  await writeCollection("articles", items);
}
