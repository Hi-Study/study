import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("로그인이 필요합니다");
  }
  return session.user;
}

export async function getOptionalUser() {
  const session = await auth();
  return session?.user ?? null;
}
