import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보처리방침 — INSIGHT" };

/** 구글 로그인 동의 화면(Google Cloud → 브랜딩)의 "개인정보처리방침 링크"가 가리키는 곳 — 로그인 없이 볼 수 있어야 한다 */
const ITEMS: { title: string; body: string }[] = [
  {
    title: "모으는 정보",
    body: "구글로 로그인할 때 구글 계정의 이메일 주소, 이름, 프로필 사진 주소를 받아요. 그 밖의 정보는 받지 않아요.",
  },
  {
    title: "쓰는 곳",
    body: "로그인한 사람인지 확인해 글 상세를 보여 주는 데만 써요. 광고나 마케팅에는 쓰지 않아요.",
  },
  {
    title: "보관하는 곳과 기간",
    body: "로그인 정보는 인증 서비스(Supabase)에 저장돼요. 계정 삭제를 요청하면 바로 지워요.",
  },
  {
    title: "이 브라우저에만 남는 정보",
    body: "저장한 글과 읽은 글 기록은 서버로 보내지 않고 쓰고 있는 브라우저에만 저장돼요. 브라우저 데이터를 지우면 함께 사라져요.",
  },
  {
    title: "다른 곳에 넘기기",
    body: "모은 정보를 다른 회사나 사람에게 넘기지 않아요.",
  },
  {
    title: "문의와 삭제 요청",
    body: "서비스를 운영하는 팀에 알려 주시면 확인 후 처리해요.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-ink-3">시행일 2026년 11월 4일</p>
      <ul className="mt-6 space-y-3">
        {ITEMS.map((x) => (
          <li key={x.title} className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-bold">{x.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{x.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
