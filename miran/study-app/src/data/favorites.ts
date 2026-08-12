// distill 기업(블로그) 즐겨찾기 — 홈 정렬 + (후속) 새 글 알림 대상. 본인만.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

// ---- raw ----
export async function listFavoriteBlogIds(uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_blog_favorites")
    .select("blog_id")
    .eq("user_id", uid);
  if (error) throw error;
  return (data ?? []).map((r) => r.blog_id);
}

export async function setBlogFavorite(
  uid: string,
  blogId: string,
  favorite: boolean,
): Promise<void> {
  if (favorite) {
    const { error } = await supabase
      .from("user_blog_favorites")
      .upsert({ user_id: uid, blog_id: blogId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_blog_favorites")
      .delete()
      .eq("user_id", uid)
      .eq("blog_id", blogId);
    if (error) throw error;
  }
}

// ---- hooks ----
export function useFavoriteBlogIds() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.favoriteBlogs(uid),
    queryFn: () => listFavoriteBlogIds(uid),
    enabled: Boolean(uid),
  });
}

export function useToggleBlogFavorite() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { blogId: string; favorite: boolean }) =>
      setBlogFavorite(uid, input.blogId, input.favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.favoriteBlogs(uid) }),
  });
}
