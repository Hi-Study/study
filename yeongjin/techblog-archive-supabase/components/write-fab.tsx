"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

// 이전엔 홈/피드 페이지 안에 각자 + 버튼을 심어놔서 토론/검색/마이 탭에서는
// 글을 등록하러 홈으로 되돌아가야 했다. 레이아웃 한 곳으로 옮겨 모든 탭에서
// 동일하게 노출한다. 글쓰기 화면 자체에서는 자기 자신 위에 뜨는 게 어색해서 숨김.
export function WriteFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/articles")) return null;

  return (
    <Button
      asChild
      size="icon"
      className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
    >
      <Link href="/articles/new" aria-label="글 등록">
        <Plus className="h-6 w-6" />
      </Link>
    </Button>
  );
}
