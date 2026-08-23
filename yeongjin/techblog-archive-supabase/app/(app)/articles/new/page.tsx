import { ArticleForm } from "@/components/article-form";
import { BackButton } from "@/components/back-button";
import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { getDraftById } from "@/lib/db/drafts";
import { createClient } from "@/lib/supabase/server";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

export const dynamic = "force-dynamic";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftId } = await searchParams;

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const initialDraft = draftId ? await getDraftById(draftId, userKey) : null;

  return (
    <div>
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <BackButton />
        <h1 className="text-lg font-semibold">글 등록</h1>
      </header>
      <ArticleForm initialDraft={initialDraft} />
    </div>
  );
}
