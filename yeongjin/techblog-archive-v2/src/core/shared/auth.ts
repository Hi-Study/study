/**
 * 로그인(구글 · Supabase Auth) — 홈·피드·검색은 누구나, 글 상세·마이는 로그인한 사람만.
 * 로그인 상태는 Supabase 가 쿠키에 담는다(@supabase/ssr). 글 데이터는 여전히 db.ts 의 service_role 키로 읽는다.
 * 구글 쪽·Supabase 대시보드 설정: docs/05_배포와_자동수집.md
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/** 로그인해야 들어갈 수 있는 경로 — proxy 와 페이지가 같은 목록을 본다 */
const LOGIN_REQUIRED = ["/articles", "/my"];
export const needsLogin = (path: string) => LOGIN_REQUIRED.some((p) => path === p || path.startsWith(`${p}/`));

/** 로그인에 쓰는 공개 키(anon) — 없으면 null. 로그인 화면이 "설정이 안 됐어요"로 알린다 */
export function authConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** 서버 컴포넌트·라우트 핸들러용 — 요청마다 새로 만든다 */
export async function authClient() {
  const cfg = authConfig();
  if (!cfg) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY 가 없습니다. 구글 로그인에 필요해요 — .env.local 과 배포 환경변수를 확인해 주세요.");
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // 서버 컴포넌트에서는 쿠키를 쓸 수 없다 — 토큰 갱신은 proxy 가 맡으니 여기서는 넘어간다
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

/** 지금 로그인한 사람 — 없으면 null. 한 번 그리는 동안에는 한 번만 확인한다 */
export const currentUser = cache(async () => {
  if (!authConfig()) return null;
  const { data } = await (await authClient()).auth.getClaims();
  return data ? { id: data.claims.sub, email: data.claims.email ?? "" } : null;
});

/** 로그인해야 보이는 화면 맨 앞에서 부른다 — proxy 를 지나쳐 들어와도 여기서 한 번 더 막는다 */
export async function requireUser(path: string) {
  const user = await currentUser();
  if (!user) redirect(loginHref(path));
  return user;
}

/** 로그인하러 가기 전 "가려던 주소"를 쿠키에도 적어 둔다 — 돌아오는 주소에서 ?next= 가 빠져도(Supabase 가 Site URL 로 보낼 때) 여기서 찾는다 */
export const NEXT_COOKIE = "tbp-login-next";

export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** 로그인 뒤 돌아갈 주소 — 우리 사이트 안의 경로만 받는다(다른 사이트로 튕겨 보내는 링크 막기) */
export function safeNext(v: string | null | undefined): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
