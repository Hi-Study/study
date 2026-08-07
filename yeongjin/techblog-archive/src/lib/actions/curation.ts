"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// 3.6 큐레이션 — 다중 선택 가능한 관심 키워드 칩 토글
export async function toggleKeywordChipAction(chipId: string): Promise<{ selected: boolean }> {
  const user = await requireUser();

  const existing = await prisma.userKeywordSelection.findUnique({
    where: { userId_chipId: { userId: user.id, chipId } },
  });

  if (existing) {
    await prisma.userKeywordSelection.delete({
      where: { userId_chipId: { userId: user.id, chipId } },
    });
    revalidatePath("/curation");
    revalidatePath("/my");
    return { selected: false };
  }

  await prisma.userKeywordSelection.create({ data: { userId: user.id, chipId } });
  revalidatePath("/curation");
  revalidatePath("/my");
  return { selected: true };
}
