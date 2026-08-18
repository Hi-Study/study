"use client";

import { ArticleThumbnail } from "@/components/article-thumbnail";
import type { ArticleCardData } from "@/components/article-card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 상단 추천 큐레이션 — 큰 카드를 가로로 스와이프하는 형태(레퍼런스 UI 구조 참고).
export function HeroCarousel({ articles }: { articles: ArticleCardData[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIndex(index);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      <div
        ref={scrollRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-4"
      >
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="relative mr-3 aspect-[4/5] w-[calc(100%-1rem)] shrink-0 snap-center overflow-hidden rounded-2xl last:mr-0"
          >
            <div className="absolute inset-0">
              <ArticleThumbnail thumbnailUrl={article.thumbnailUrl} company={article.company} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="line-clamp-2 text-xl font-bold text-white">{article.title}</p>
              {article.summary ? (
                <p className="mt-2 line-clamp-1 text-sm text-white/80">{article.summary}</p>
              ) : null}
              <p className="mt-2 text-xs text-white/60">{article.company}</p>
            </div>
          </Link>
        ))}
      </div>

      {articles.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {articles.map((article, i) => (
            <span
              key={article.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === activeIndex ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
