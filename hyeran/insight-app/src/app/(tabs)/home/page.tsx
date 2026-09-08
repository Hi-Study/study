import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHomeData, getReadPostIds, getBookmarkedPostIds } from "@/lib/queries";
import FeedCard from "@/components/FeedCard";
import PostRow from "@/components/PostRow";
import DragScroll from "@/components/DragScroll";
import Icon from "@/components/Icon";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

// 홈은 큐레이션 섹션만으로 이뤄진다 [분류체계 §6-1]
// 섹션 제목은 카피이고 분류값이 아니다. 분류값 칩은 카드에 넣지 않는다.
export default async function HomePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [home, readIds, bmIds] = await Promise.all([
    getHomeData(),
    getReadPostIds(user!.id),
    getBookmarkedPostIds(user!.id),
  ]);
  const mark = (p: Post) => ({ ...p, read: readIds.has(p.id), bookmarked: bmIds.has(p.id) });

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/search" className="iconbtn" aria-label="검색"><Icon name="search" /></Link>
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        {/* 큐레이션 섹션 — 후보 6편 미만이면 getHomeData 가 통째로 뺀다.
            두 번째 섹션 뒤에 탐색 진입 블록을 끼운다 [§6-1] */}
        {home.sections.map((sec, i) => (
          <div key={sec.title}>
            <section className="hsec">
              <div className="hsec-head">
                <div>
                  <div className="hsec-title">{sec.title}</div>
                  <div className="hsec-sub">{sec.sub}</div>
                </div>
              </div>
              <DragScroll className="swipe">
                {sec.posts.map((p) => <FeedCard key={p.id} post={mark(p)} />)}
              </DragScroll>
            </section>
            {i === 1 && (
              <section className="hsec">
                <Link href="/search" className="probe">
                  <div className="probe-txt">
                    <b>지금 겪는 문제로 찾아보기</b>
                    <span>이탈, 검색, 운영 수작업, 계속…</span>
                  </div>
                  <span className="probe-go"><Icon name="chevron" /></span>
                </Link>
              </section>
            )}
          </div>
        ))}

        {/* 새로 들어온 글 */}
        {home.latest.length > 0 && (
          <section className="hsec">
            <div className="hsec-head">
              <div><div className="hsec-title">새로 들어온 글</div></div>
              <Link href="/feed" className="see-all">더보기</Link>
            </div>
            <div className="feed-list">
              {home.latest.map((p) => <PostRow key={p.id} post={mark(p)} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
