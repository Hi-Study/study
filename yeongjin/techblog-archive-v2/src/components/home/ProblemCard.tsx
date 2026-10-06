import Link from "next/link";

/** 밝은 대표 색(노랑·연두 등)이면 글자를 어둡게 — 흰 글자는 읽히지 않는다 */
function isLight(hex: string): boolean {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return false;
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/**
 * "이런 문제를 어떻게 풀었을까요?" 카드
 * [서비스명] → [문제 제목: 누구나 이해하는 말] → [✦ 요약: 어떤 문제를 어떻게 풀었는지]
 */
export function ProblemCard({
  id,
  company,
  color,
  logo,
  title,
  summary,
}: {
  id: number;
  company: string;
  color: string;
  logo: string | null;
  title: string;
  summary: string;
}) {
  const bg = color === "#111111" ? "#2b2f36" : color;
  const light = isLight(bg);
  return (
    <Link
      href={`/articles/${id}`}
      className={`flex w-[288px] shrink-0 snap-start flex-col rounded-3xl p-5 transition hover:brightness-105 ${light ? "text-ink" : "text-white"}`}
      style={{ background: bg }}
    >
      <span className="flex items-center gap-2">
        <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-4 object-contain" />
          ) : (
            <span className="text-[11px] font-bold" style={{ color: bg }}>
              {company.slice(0, 1)}
            </span>
          )}
        </span>
        <span className={`text-sm font-bold ${light ? "text-ink/80" : "text-white/90"}`}>{company}</span>
      </span>

      <p className="mt-3 text-[19px] font-extrabold leading-[1.35] tracking-tight">{title}</p>

      <div className={`mt-auto rounded-2xl p-3.5 ${light ? "bg-white/55" : "bg-white/15"}`} style={{ marginTop: "1rem" }}>
        <p className={`text-xs font-bold ${light ? "text-ink/70" : "text-white/90"}`}>✦ 아카이브 요약</p>
        <p className={`mt-1 line-clamp-4 text-sm leading-relaxed ${light ? "text-ink/85" : "text-white/90"}`}>{summary}</p>
      </div>
    </Link>
  );
}
