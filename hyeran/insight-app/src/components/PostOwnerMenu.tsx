"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { deletePost } from "@/app/posts/[id]/actions";

export default function PostOwnerMenu({
  postId, reviewCount = 0, commentCount = 0,
}: { postId: string; reviewCount?: number; commentCount?: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const hasEngagement = reviewCount > 0 || commentCount > 0;

  const remove = () => start(async () => { await deletePost(postId); });

  return (
    <>
      <button className="iconbtn" aria-label="수정" onClick={() => router.push(`/posts/${postId}/edit`)}>
        <Icon name="edit" />
      </button>
      <button className="iconbtn" aria-label="삭제" onClick={() => setConfirm(true)}>
        <Icon name="trash" />
      </button>

      {confirm && (
        <>
          <div className="scrim show" onClick={() => !pending && setConfirm(false)} />
          <div className="confirm-box">
            <div className="ct">글을 삭제할까요</div>
            <div className="cs">
              {hasEngagement
                ? `이 글에 인사이트 ${reviewCount}개, 댓글 ${commentCount}개가 달려 있어요. 삭제하면 모두 함께 사라져요.`
                : "이 글과 달린 인사이트·댓글이 모두 사라져요."}
            </div>
            <div className="crow">
              <button className="btn btn-outline" disabled={pending} onClick={() => setConfirm(false)}>취소</button>
              <button className="btn btn-danger" disabled={pending} onClick={remove}>{pending ? "삭제 중…" : "삭제"}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
