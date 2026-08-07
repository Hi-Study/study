"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(50),
  email: z.string().trim().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다").max(72),
});

export type ActionState = { error?: string } | undefined;

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "이미 가입된 이메일입니다" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  try {
    await signIn("credentials", { email, password, redirectTo: "/explore" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "가입은 완료됐지만 자동 로그인에 실패했습니다. 다시 로그인해주세요." };
    }
    throw err;
  }
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", { email, password, redirectTo: "/explore" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다" };
    }
    throw err;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
