import { prisma } from "@/lib/prisma";
import type { Category, ReadStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PostCard = {
  id: string;
  title: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  originalUrl: string;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  category: Category;
  sourceType: "AUTO_COLLECTED" | "MEMBER_REGISTERED";
  registeredByName: string | null;
  summaryFirstLine: string | null;
  bookmarkCount: number;
  commentCount: number;
  readStatus: ReadStatus | null;
  bookmarked: boolean;
};

const cardInclude = {
  company: true,
  registeredBy: { select: { name: true } },
  summary: true,
  _count: { select: { bookmarks: true, comments: true } },
} as const;

type PostWithCardRelations = Prisma.PostGetPayload<{ include: typeof cardInclude }>;

function toPostCard(
  post: PostWithCardRelations,
  currentUserId: string,
  bookmarkedIds: Set<string>,
  readStates: Map<string, ReadStatus>
): PostCard {
  const lines = (post.summary?.lines as string[] | null) ?? null;
  return {
    id: post.id,
    title: post.title,
    companyName: post.company?.name ?? null,
    companyLogoUrl: post.company?.logoUrl ?? null,
    originalUrl: post.originalUrl,
    thumbnailUrl: post.thumbnailUrl,
    publishedAt: post.publishedAt,
    category: post.category,
    sourceType: post.sourceType,
    registeredByName: post.registeredBy?.name ?? null,
    summaryFirstLine: lines && lines.length > 0 ? lines[0] : null,
    bookmarkCount: post._count.bookmarks,
    commentCount: post._count.comments,
    readStatus: readStates.get(post.id) ?? null,
    bookmarked: bookmarkedIds.has(post.id),
  };
}

async function attachUserState(posts: PostWithCardRelations[], currentUserId: string): Promise<PostCard[]> {
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);

  const [bookmarks, readStates] = await Promise.all([
    prisma.bookmark.findMany({ where: { userId: currentUserId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.readingState.findMany({
      where: { userId: currentUserId, postId: { in: postIds } },
      select: { postId: true, status: true },
    }),
  ]);

  const bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
  const readStateMap = new Map(readStates.map((r) => [r.postId, r.status]));

  return posts.map((p) => toPostCard(p, currentUserId, bookmarkedIds, readStateMap));
}

export async function getExploreFeed(params: {
  currentUserId: string;
  companySlug?: string;
  category?: Category;
  cursor?: string;
  take?: number;
}) {
  const { currentUserId, companySlug, category, cursor, take = 20 } = params;

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      category,
      company: companySlug ? { slug: companySlug } : undefined,
    },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return attachUserState(posts, currentUserId);
}

export async function getWeeklyPopularPosts(params: {
  currentUserId: string;
  limit: number;
  excludeIds?: string[];
}) {
  const { currentUserId, limit, excludeIds = [] } = params;
  const since = new Date(Date.now() - WEEK_MS);

  const grouped = await prisma.postView.groupBy({
    by: ["postId"],
    where: { viewedAt: { gte: since }, postId: { notIn: excludeIds } },
    _count: { postId: true },
    orderBy: { _count: { postId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: { id: { in: grouped.map((g) => g.postId) }, deletedAt: null },
    include: cardInclude,
  });

  const order = new Map(grouped.map((g, idx) => [g.postId, idx]));
  posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return attachUserState(posts, currentUserId);
}

// 3.6 큐레이션 — 선택한 칩의 카테고리로 우선 매칭, 부족하면 이번 주 인기 글로 보충
export async function getCurationFeed(params: { currentUserId: string; take?: number }) {
  const { currentUserId, take = 20 } = params;

  const selections = await prisma.userKeywordSelection.findMany({
    where: { userId: currentUserId },
    include: { chip: true },
  });

  const categories = Array.from(new Set(selections.map((s) => s.chip.category)));

  let matched: PostWithCardRelations[] = [];
  if (categories.length > 0) {
    matched = await prisma.post.findMany({
      where: { deletedAt: null, category: { in: categories } },
      include: cardInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  const matchedCards = await attachUserState(matched, currentUserId);

  if (matchedCards.length >= take) {
    return { cards: matchedCards, selectedCategories: categories, usedFallback: false };
  }

  const fallback = await getWeeklyPopularPosts({
    currentUserId,
    limit: take - matchedCards.length,
    excludeIds: matched.map((m) => m.id),
  });

  return {
    cards: [...matchedCards, ...fallback],
    selectedCategories: categories,
    usedFallback: fallback.length > 0,
  };
}

export async function searchPosts(params: { currentUserId: string; query: string; take?: number }) {
  const { currentUserId, query, take = 30 } = params;
  if (!query.trim()) return [];

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { authorName: { contains: query, mode: "insensitive" } },
        { company: { name: { contains: query, mode: "insensitive" } } },
        { tags: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
      ],
    },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
    take,
  });

  return attachUserState(posts, currentUserId);
}

export async function getCompanies() {
  return prisma.company.findMany({ orderBy: { name: "asc" } });
}

export async function getKeywordChips() {
  return prisma.keywordChip.findMany({ orderBy: { label: "asc" } });
}

export async function getSelectedChipIds(userId: string) {
  const selections = await prisma.userKeywordSelection.findMany({ where: { userId }, select: { chipId: true } });
  return new Set(selections.map((s) => s.chipId));
}

export async function getMyLibrary(userId: string) {
  const [bookmarkCount, doneCount, memoCount, continueReading, savedPosts, myPosts, myComments, myMemos, selections] =
    await Promise.all([
      prisma.bookmark.count({ where: { userId } }),
      prisma.readingState.count({ where: { userId, status: "DONE" } }),
      prisma.memo.count({ where: { userId } }),
      prisma.bookmark.findMany({
        where: { userId, post: { readingStates: { none: { userId, status: "DONE" } } } },
        include: { post: { include: cardInclude } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.bookmark.findMany({
        where: { userId },
        include: { post: { include: cardInclude } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.findMany({
        where: { registeredById: userId, deletedAt: null },
        include: cardInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.comment.findMany({
        where: { authorId: userId, deletedAt: null },
        include: { post: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.memo.findMany({
        where: { userId },
        include: { post: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userKeywordSelection.findMany({ where: { userId }, include: { chip: true } }),
    ]);

  const [continueReadingCards, savedCards, myPostCards] = await Promise.all([
    attachUserState(continueReading.map((b) => b.post), userId),
    attachUserState(savedPosts.map((b) => b.post), userId),
    attachUserState(myPosts, userId),
  ]);

  return {
    stats: { bookmarkCount, doneCount, memoCount },
    continueReading: continueReadingCards,
    savedPosts: savedCards,
    myPosts: myPostCards,
    myComments,
    myMemos,
    selectedChips: selections.map((s) => s.chip),
  };
}

export async function getPostDetail(postId: string, currentUserId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      company: true,
      summary: true,
      registeredBy: { select: { id: true, name: true } },
      registrantNotes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      tags: { include: { tag: true } },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: { name: true } },
          replies: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      discussions: {
        include: {
          requester: { select: { name: true } },
          participants: { where: { isActive: true }, include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      memos: { where: { OR: [{ userId: currentUserId }, { isPublic: true }] }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!post || post.deletedAt) return null;

  const [bookmark, readingState] = await Promise.all([
    prisma.bookmark.findUnique({ where: { userId_postId: { userId: currentUserId, postId } } }),
    prisma.readingState.findUnique({ where: { userId_postId: { userId: currentUserId, postId } } }),
  ]);

  return { post, bookmarked: Boolean(bookmark), readStatus: readingState?.status ?? "BEFORE" };
}

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, createdAt: true } });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function getNotifications(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
}

export async function getDiscussionDetail(discussionId: string, currentUserId: string) {
  const discussion = await prisma.discussion.findUnique({
    where: { id: discussionId },
    include: {
      post: { select: { id: true, title: true } },
      requester: { select: { id: true, name: true } },
      participants: { where: { isActive: true }, include: { user: { select: { id: true, name: true } } } },
      messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!discussion) return null;

  const isParticipant = discussion.participants.some((p) => p.userId === currentUserId);
  return { discussion, isParticipant };
}
