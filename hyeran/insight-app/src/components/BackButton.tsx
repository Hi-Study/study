"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

export default function BackButton() {
  const router = useRouter();
  return (
    <button className="iconbtn" onClick={() => router.back()} aria-label="뒤로">
      <Icon name="back" />
    </button>
  );
}
