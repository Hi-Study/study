import { auth } from "@/lib/auth";
import { getCurationFeed, getKeywordChips, getSelectedChipIds } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { KeywordChipButton } from "@/components/KeywordChipButton";

export default async function CurationPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [chips, selectedIds, feed] = await Promise.all([
    getKeywordChips(),
    getSelectedChipIds(userId),
    getCurationFeed({ currentUserId: userId }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">큐레이션</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          관심 있는 질문을 골라주시면 관련 카테고리 글을 우선 보여드려요
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        {chips.map((chip) => (
          <KeywordChipButton key={chip.id} chipId={chip.id} label={chip.label} initialSelected={selectedIds.has(chip.id)} />
        ))}
      </div>

      {feed.selectedCategories.length === 0 ? (
        <p className="text-xs text-neutral-400">
          아직 선택한 키워드가 없어 이번 주 인기 글을 보여드리고 있어요. 위 칩을 선택하면 맞춤 피드로 바뀝니다.
        </p>
      ) : feed.usedFallback ? (
        <p className="text-xs text-neutral-400">선택한 키워드와 맞는 글이 적어 이번 주 인기 글로 나머지를 채웠어요.</p>
      ) : null}

      {feed.cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400 dark:border-neutral-700">
          아직 추천할 글이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {feed.cards.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
