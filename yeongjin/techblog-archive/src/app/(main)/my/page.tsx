import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMyLibrary, getUserProfile, getKeywordChips, getSelectedChipIds } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";
import { formatRelativeDate } from "@/lib/labels";
import { KeywordChipButton } from "@/components/KeywordChipButton";
import { MemoDeleteButton } from "@/components/MemoActions";

const TABS = [
  { key: "posts", label: "내가 올린 글" },
  { key: "comments", label: "내 댓글" },
  { key: "memos", label: "작성한 메모" },
  { key: "keywords", label: "관심 키워드 설정" },
] as const;

export default async function MyLibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "posts" } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const [profile, library, chips, selectedChipIds] = await Promise.all([
    getUserProfile(userId),
    getMyLibrary(userId),
    getKeywordChips(),
    getSelectedChipIds(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
          {profile?.name?.[0] ?? "?"}
        </div>
        <div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{profile?.name}</p>
          <p className="text-xs text-neutral-400">
            {profile?.email} · {formatRelativeDate(profile?.createdAt ?? null)} 가입
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <StatCard label="저장한 아티클" value={library.stats.bookmarkCount} />
        <StatCard label="읽은 아티클" value={library.stats.doneCount} />
        <StatCard label="작성한 메모" value={library.stats.memoCount} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">이어서 읽을 아티클</h2>
        {library.continueReading.length === 0 ? (
          <p className="text-sm text-neutral-400">다 읽지 않은 저장 글이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {library.continueReading.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">저장한 아티클</h2>
        {library.savedPosts.length === 0 ? (
          <p className="text-sm text-neutral-400">북마크한 글이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {library.savedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/my?tab=${t.key}`}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-400"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-4">
          {tab === "posts" && (
            library.myPosts.length === 0 ? (
              <p className="text-sm text-neutral-400">내가 등록한 글이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {library.myPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )
          )}

          {tab === "comments" && (
            library.myComments.length === 0 ? (
              <p className="text-sm text-neutral-400">작성한 댓글이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {library.myComments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <Link href={`/posts/${c.post.id}`} className="font-medium text-neutral-800 hover:underline dark:text-neutral-100">
                      {c.post.title}
                    </Link>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">{c.content}</p>
                    <p className="mt-1 text-xs text-neutral-400">{formatRelativeDate(c.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === "memos" && (
            library.myMemos.length === 0 ? (
              <p className="text-sm text-neutral-400">작성한 메모가 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {library.myMemos.map((m) => (
                  <li key={m.id} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <Link href={`/posts/${m.post.id}`} className="font-medium text-neutral-800 hover:underline dark:text-neutral-100">
                        {m.post.title}
                      </Link>
                      <MemoDeleteButton memoId={m.id} />
                    </div>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">{m.content}</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {m.isPublic ? "팀 공개" : "비공개"} · {formatRelativeDate(m.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === "keywords" && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <KeywordChipButton key={chip.id} chipId={chip.id} label={chip.label} initialSelected={selectedChipIds.has(chip.id)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
