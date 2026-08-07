import { auth } from "@/lib/auth";
import { searchPosts } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const results = q ? await searchPosts({ currentUserId: userId, query: q }) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">검색</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">키워드, 태그, 회사, 작성자로 글을 찾아보세요</p>
      </div>

      <form className="flex gap-2" action="/search">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="예) 트래픽, 토스, MSA..."
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
        >
          검색
        </button>
      </form>

      {q ? (
        results.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">&quot;{q}&quot;에 대한 검색 결과가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )
      ) : (
        <p className="py-8 text-center text-sm text-neutral-400">검색어를 입력해주세요.</p>
      )}
    </div>
  );
}
