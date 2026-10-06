"use client";

import Link from "next/link";
import { useState } from "react";
import { CompanyBadge, formatDate } from "@/components/common/ArticleCard";
import { clearList, useLocalList } from "@/core/shared/local-store";

type Item = { id: number; companyId: string; title: string; hook: string; publishedAt: string };

export function MyLists({ items }: { items: Item[] }) {
  const [tab, setTab] = useState<"bookmarks" | "read">("bookmarks");
  const bookmarks = useLocalList<number>("bookmarks");
  const read = useLocalList<number>("read");
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = tab === "bookmarks" ? bookmarks : read;
  const list = ids.map((id) => byId.get(id)).filter((x): x is Item => !!x);

  return (
    <div className="mt-6">
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(
          [
            ["bookmarks", `저장한 글 ${bookmarks.length}`],
            ["read", `읽은 글 ${read.length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "text-ink-2"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
          {tab === "bookmarks" ? "글 상세에서 ☆ 저장을 누르면 여기에 모여요." : "아직 읽은 글이 없어요."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/articles/${a.id}`} className="block px-5 py-4 hover:bg-bg">
                <div className="flex items-center justify-between">
                  <CompanyBadge id={a.companyId} />
                  <span className="text-xs text-ink-3">{formatDate(a.publishedAt)}</span>
                </div>
                <p className="mt-1.5 font-bold leading-snug">{a.hook}</p>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-3">{a.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && tab === "read" && (
        <button onClick={() => clearList("read")} className="mt-3 text-sm text-ink-3 underline">
          읽은 기록 지우기
        </button>
      )}
    </div>
  );
}
