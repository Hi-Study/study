/** 댓글 정렬 모드 (dev/api.md §4). */
export type CommentSort = "recent" | "likes";

/**
 * 댓글 정렬. 'recent'=등록순(입력 그대로), 'likes'=좋아요순(동률이면 등록순).
 * 입력은 이미 created_at 오름차순이라고 가정.
 */
export function sortComments<T extends { likeCount: number; created_at: string }>(
  list: T[],
  mode: CommentSort,
): T[] {
  if (mode === "recent") return list;
  return [...list].sort(
    (a, b) => b.likeCount - a.likeCount || (a.created_at < b.created_at ? -1 : 1),
  );
}

export interface ThreadItem<T> {
  comment: T;
  depth: number; // 0=최상위, 1=답글
}

interface Threadable {
  id: string;
  parent_id: string | null;
  likeCount: number;
  created_at: string;
}

/**
 * 댓글을 스레드 구조로 정렬:
 *  - 최상위 댓글을 정렬(방장 고정 pinnedId 는 항상 최상단, 그다음 mode)
 *  - 각 최상위 댓글 바로 아래에 그 답글(등록순)을 depth=1 로 붙임
 */
export function threadComments<T extends Threadable>(
  list: T[],
  mode: CommentSort,
  pinnedId?: string | null,
): ThreadItem<T>[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  const tops = list.filter((c) => !c.parent_id);
  const repliesByParent: Record<string, T[]> = {};
  for (const c of list) {
    if (c.parent_id) (repliesByParent[c.parent_id] ||= []).push(c);
  }

  // 방장 결론이 "답글"이면 그 답글이 속한 최상위 댓글(스레드 전체)을 최상단으로.
  let pinnedTopId: string | null = pinnedId ?? null;
  if (pinnedId) {
    let cur = byId.get(pinnedId);
    while (cur?.parent_id && byId.has(cur.parent_id)) cur = byId.get(cur.parent_id);
    pinnedTopId = cur?.id ?? pinnedId;
  }

  const byCreated = (a: T, b: T) => (a.created_at < b.created_at ? -1 : 1);
  const sortedTops = [...tops].sort((a, b) => {
    if (pinnedTopId) {
      if (a.id === pinnedTopId) return -1;
      if (b.id === pinnedTopId) return 1;
    }
    if (mode === "likes") return b.likeCount - a.likeCount || byCreated(a, b);
    return byCreated(a, b);
  });

  const out: ThreadItem<T>[] = [];
  const placed = new Set<string>();
  for (const t of sortedTops) {
    out.push({ comment: t, depth: 0 });
    placed.add(t.id);
    for (const r of (repliesByParent[t.id] ?? []).sort(byCreated)) {
      out.push({ comment: r, depth: 1 });
      placed.add(r.id);
    }
  }
  // 부모가 답글이었던(2단계 이상) 경우까지 유실 없이 뒤에 붙임.
  for (const c of list) {
    if (!placed.has(c.id)) out.push({ comment: c, depth: 1 });
  }
  return out;
}
