// distill 글 등록(URL) — register 엣지함수로 본문 추출+삽입 후 article 로 이동.
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface RegisterResult {
  articleId: string;
  title: string;
  existed: boolean; // 이미 등록돼 있던 글인지
}

export async function registerArticle(uid: string, url: string): Promise<RegisterResult> {
  const { data, error } = await supabase.functions.invoke("register", {
    body: { url, user_id: uid },
  });
  if (error) throw error;
  const d = data as { article_id?: string; title?: string; existed?: boolean; error?: string };
  if (!d?.article_id) throw new Error(d?.error ?? "등록에 실패했어요.");
  return { articleId: d.article_id, title: d.title ?? "", existed: !!d.existed };
}

export function useRegisterArticle() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => registerArticle(uid, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.articles() }),
  });
}
