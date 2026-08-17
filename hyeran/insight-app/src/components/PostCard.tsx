import Link from "next/link";
import Icon from "@/components/Icon";
import { coverImage, catFg, type Category, type Post } from "@/lib/types";

// ===== 카테고리 배지 (11개 → 4계열 글자색) =====
function CatBadge({ category }: { category: Category }) {
  return (
    <span className="qc-cat" style={{ ["--catbg" as string]: "var(--surface)", ["--catfg" as string]: catFg(category) }}>
      {category}
    </span>
  );
}

// ===== 실제 기업 로고 (인라인 SVG) — 도메인/이름으로 매칭, 없으면 이니셜 폴백 =====
type Mark = React.ReactNode;
const LOGOS: { test: RegExp; svg: Mark }[] = [
  { test: /toss/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#3182F6" /><text x="20" y="26" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="13.5" fontWeight="700" fill="#fff">toss</text></svg>
  ) },
  { test: /kakao/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#FEE500" /><ellipse cx="20" cy="18.5" rx="11.5" ry="9" fill="#3B1E1E" /><path d="M12.5 24.5c.6 2.2.2 3.9-.4 5 2.2-.6 3.8-1.6 4.7-2.4z" fill="#3B1E1E" /><ellipse cx="20" cy="18.5" rx="8" ry="6" fill="#FEE500" /></svg>
  ) },
  { test: /naver|d2\./i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#03C75A" /><path d="M14 12h5.3l5.4 8V12H30v16h-5.3L19.3 20v8H14z" fill="#fff" /></svg>
  ) },
  { test: /woowa|baemin|배민|우아한/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#2AC1BC" /><text x="20" y="26" textAnchor="middle" fontFamily="Pretendard, system-ui, sans-serif" fontSize="14" fontWeight="800" fill="#fff">배민</text></svg>
  ) },
  { test: /daangn|karrot|당근/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#FF7E36" /><path d="M18.5 30.5c-3.2-1.6-6.2-6.8-4.6-10 1-2 5.2-2.2 8.2-.6 2.8 1.6 1.8 5.8-.4 8.6-1.2 1.5-2.4 2.2-3.2 2z" fill="#fff" /><path d="M22 16.5c.4-2.6 2.2-4.4 4.8-4.8-.2 2.8-1.8 4.6-4.8 4.8z" fill="#fff" /><path d="M20 17c-.8-2.2-2.6-3.6-5-3.8.4 2.4 2 4 5 3.8z" fill="#fff" opacity=".85" /></svg>
  ) },
  { test: /line/i, svg: (
    <svg viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#06C755" /><text x="20" y="25" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="800" fill="#fff">LINE</text></svg>
  ) },
];

function logoFor(company?: { name: string; domain?: string | null } | null): Mark {
  if (!company) return null;
  const key = `${company.domain ?? ""} ${company.name}`;
  return LOGOS.find((l) => l.test.test(key))?.svg ?? null;
}

export function CompanyLogo({ company }: { company?: { name: string; color: string; domain?: string | null } | null }) {
  if (!company) return null;
  const svg = logoFor(company);
  return (
    <span className="clogo" style={svg ? undefined : { background: company.color }}>
      {svg ?? company.name[0]}
    </span>
  );
}

// ===== 오늘의 글 매거진 히어로 (홈 최상단 1장, 큰 이미지) =====
export function FeatureCard({ post }: { post: Post }) {
  const cover = coverImage(post);
  const cc = post.company?.color ?? "#161616";
  const label = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  const scrim = "linear-gradient(to top, rgba(0,0,0,.86) 0%, rgba(0,0,0,.15) 52%, rgba(0,0,0,.30) 100%)";
  return (
    <Link
      className={`feature${cover ? "" : " ph"}`}
      href={`/posts/${post.id}`}
      style={{ ["--cc" as string]: cc, ...(cover ? { backgroundImage: `${scrim}, url("${cover}")` } : {}) }}
    >
      <span className="feat-eyebrow"><Icon name="sparkle" size="sm" />오늘의 글</span>
      {!cover && <span className="feat-phlogo"><CompanyLogo company={post.company} /></span>}
      <div className="feat-bottom">
        <h2 className="feat-title">{post.title}</h2>
        <div className="feat-foot">
          <span className="feat-src">{label}</span>
          <span className="feat-cnt"><Icon name="eye" size="sm" />{post.read_count ?? 0}</span>
          <span className="feat-cnt"><Icon name="review" size="sm" />{post.review_count ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}

// ===== 조용한 카드 상단행 (로고 + 기업/도메인 + 카테고리) =====
function CardTop({ post }: { post: Post }) {
  const name = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  const domain = post.company?.domain ?? (post.source === "direct" ? "직접 등록" : "");
  return (
    <div className="qc-top">
      <CompanyLogo company={post.company} />
      <span className="qc-co">
        <span className="co">{name}</span>
        {domain && <span className="dm">{domain}</span>}
      </span>
      <CatBadge category={post.category} />
    </div>
  );
}

function CardFoot({ post }: { post: Post }) {
  return (
    <div className="qc-foot">
      {post.read && <span className="qc-read">읽음</span>}
      <span className="qc-cnt"><Icon name="review" size="sm" />인사이트 {post.review_count ?? 0}</span>
    </div>
  );
}

// 전체 카드 (피드/검색/마이)
export default function PostCard({ post }: { post: Post }) {
  const cc = post.company?.color;
  return (
    <Link className="card" href={`/posts/${post.id}`} style={cc ? { ["--cc" as string]: cc } : undefined}>
      <CardTop post={post} />
      <h3>{post.title}</h3>
      {post.tags.length > 0 && (
        <div className="tagrow">
          {post.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
        </div>
      )}
      <CardFoot post={post} />
    </Link>
  );
}

// 홈 스와이프용 컴팩트 카드
export function SwipeCard({ post }: { post: Post }) {
  const cc = post.company?.color;
  return (
    <Link className="scard" href={`/posts/${post.id}`} style={cc ? { ["--cc" as string]: cc } : undefined}>
      <CardTop post={post} />
      <h3>{post.title}</h3>
      <CardFoot post={post} />
    </Link>
  );
}
