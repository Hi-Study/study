import { createClient } from "@/lib/supabase/server";
import type { FeedPost, Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, name, initial")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function getFeedPosts(): Promise<FeedPost[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!posts_sharer_id_fkey(id, name, initial)")
    .order("created_at", { ascending: false });

  if (!posts) return [];

  const postIds = posts.map((p) => p.id);

  const [{ data: talks }, { data: bookmarks }, { data: comments }] = await Promise.all([
    supabase.from("talks").select("post_id, user_id").in("post_id", postIds),
    user
      ? supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    supabase
      .from("comments")
      .select("id, highlight_id, highlights!inner(post_id)")
      .in("highlights.post_id", postIds),
  ]);

  const talkCountByPost = new Map<string, number>();
  const talkedByMe = new Set<string>();
  (talks || []).forEach((t) => {
    talkCountByPost.set(t.post_id, (talkCountByPost.get(t.post_id) || 0) + 1);
    if (user && t.user_id === user.id) talkedByMe.add(t.post_id);
  });

  const bookmarkedSet = new Set((bookmarks || []).map((b) => b.post_id));

  const commentCountByPost = new Map<string, number>();
  (comments || []).forEach((c: { highlights: { post_id: string } | { post_id: string }[] }) => {
    const postId = Array.isArray(c.highlights) ? c.highlights[0]?.post_id : c.highlights?.post_id;
    if (!postId) return;
    commentCountByPost.set(postId, (commentCountByPost.get(postId) || 0) + 1);
  });

  return posts.map((p) => ({
    ...p,
    sharer: p.profiles,
    talkCount: talkCountByPost.get(p.id) || 0,
    talked: talkedByMe.has(p.id),
    bookmarked: bookmarkedSet.has(p.id),
    commentCount: commentCountByPost.get(p.id) || 0,
  }));
}

export async function getPostDetail(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("posts")
    .select("*, profiles!posts_sharer_id_fkey(id, name, initial)")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return null;

  const { data: highlights } = await supabase
    .from("highlights")
    .select("*, profiles!highlights_owner_id_fkey(id, name, initial)")
    .eq("post_id", postId)
    .order("para_idx", { ascending: true });

  const highlightIds = (highlights || []).map((h) => h.id);

  const { data: comments } = highlightIds.length
    ? await supabase
        .from("comments")
        .select("*, profiles!comments_user_id_fkey(id, name, initial)")
        .in("highlight_id", highlightIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: talks } = await supabase.from("talks").select("user_id").eq("post_id", postId);
  const { data: myBookmark } = user
    ? await supabase
        .from("bookmarks")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return {
    post: { ...post, sharer: post.profiles },
    highlights: highlights || [],
    comments: comments || [],
    talkCount: (talks || []).length,
    talked: !!user && (talks || []).some((t) => t.user_id === user.id),
    bookmarked: !!myBookmark,
    currentUserId: user?.id ?? null,
  };
}

export async function getMyDrafts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return data || [];
}

export async function getMyHighlights() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("highlights")
    .select("id, text, created_at, posts!inner(id, title, created_at)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*, profiles!notifications_actor_id_fkey(id, name, initial)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return data || [];
}
