"use client";

import { useRef, useState } from "react";
import { FeatureCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function RankCarousel({ posts }: { posts: Post[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(posts.length - 1, i)));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="rankcar">
      <div className="rankcar-track" ref={trackRef} onScroll={onScroll}>
        {posts.map((p) => (
          <div className="rankcar-slide" key={p.id}>
            <FeatureCard post={p} />
          </div>
        ))}
      </div>
      {posts.length > 1 && (
        <div className="rankcar-dots">
          {posts.map((p, i) => (
            <button
              key={p.id}
              className={`rankcar-dot ${i === active ? "on" : ""}`}
              aria-label={`${i + 1}번째 추천 글로 이동`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
