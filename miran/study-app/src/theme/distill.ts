// distill 전용 토큰 — 주제(topic) 팔레트·문장 하이라이트 색·타입 스케일(DESIGN_GUIDE §2.4/§2.6/§3).
import {
  Atom,
  BarChart3,
  Briefcase,
  ClipboardList,
  Code,
  Gamepad2,
  HeartHandshake,
  HelpCircle,
  Landmark,
  Layers,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Palette,
  Rocket,
  ShieldCheck,
  Sparkles,
  Sprout,
  ThumbsUp,
  TrendingUp,
  User,
  Users,
  Wallet,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { PRETENDARD } from "./tokens";
import type { ImprovementType } from "@/lib/improvement";
import type {
  ArticleLevel,
  BlogKind,
  JobRole,
  StampKind,
  Topic,
} from "@/types/database";

/**
 * 주제 대분류 팔레트 — 기준 v1의 7개(docs/분류-기준-v1.md).
 *
 * ⚠️ 어느 색도 강조색(바이올렛 #7C3AED)과 겹치지 않게 골랐다. 주제 칩이 강조색을 쓰면
 *    "누를 수 있는 것"처럼 보이고, 화면당 강조색 하나 원칙도 깨진다.
 */
export const TOPIC_META: Record<
  Topic,
  { label: string; color: string; tint: string; blurb: string; icon: LucideIcon }
> = {
  quality_risk: {
    label: "품질·위험 관리",
    color: "#B2544A",
    tint: "#F9EAE8",
    blurb: "서비스 품질을 지키고 사고를 줄이는 방법",
    icon: ShieldCheck,
  },
  ai_use: {
    label: "AI 활용",
    color: "#4B53B8",
    tint: "#EAEBF8",
    blurb: "AI로 일하는 방식을 바꾸거나 기능을 만든 이야기",
    icon: Sparkles,
  },
  product_plan: {
    label: "제품·서비스 기획",
    color: "#2F6FB0",
    tint: "#E6F0F9",
    blurb: "없던 기능을 내놓거나 정책을 바꾼 과정",
    icon: Rocket,
  },
  data_exp: {
    label: "데이터·실험",
    color: "#2C8579",
    tint: "#E1F1EF",
    blurb: "지표와 A/B 테스트로 판단을 내린 이야기",
    icon: BarChart3,
  },
  user_exp: {
    label: "사용자 이해·경험",
    color: "#B5457F",
    tint: "#FAEAF3",
    blurb: "사용자 문제를 찾아내고 화면·흐름을 고친 이야기",
    icon: HeartHandshake,
  },
  biz_brand: {
    label: "사업·브랜드",
    color: "#B0762A",
    tint: "#FBF1E0",
    blurb: "매출을 만들고 브랜드를 알린 이야기",
    icon: TrendingUp,
  },
  collab: {
    label: "협업·프로세스",
    color: "#4F7A3C",
    tint: "#EBF3E6",
    blurb: "팀이 일하고 출시하는 방식을 바꾼 이야기",
    icon: Workflow,
  },
};

/**
 * 필터에 보여줄 순서 — **판단 순서와 같다**(docs/분류-기준-v1.md 2단계).
 * 분류할 때 위에서부터 물어본 순서 그대로 두면, 나중에 기준을 다시 볼 때 헷갈리지 않는다.
 */
export const TOPIC_ORDER: Topic[] = [
  "quality_risk",
  "ai_use",
  "product_plan",
  "data_exp",
  "user_exp",
  "biz_brand",
  "collab",
];

/** 문장 하이라이트(밑줄) 5색 + 위 글자색(항상 어두움). */
export const HIGHLIGHT_COLORS = {
  yellow: "#FFE58A",
  green: "#BDEEB4",
  pink: "#FFC2D6",
  blue: "#BCDCFF",
  purple: "#E2CDF6",
} as const;
export const HIGHLIGHT_INK = "#241A26";
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

/** distill 타입 스케일: { fontSize, lineHeight, fontWeight }. Pretendard(미번들 시 시스템 폴백).
 *  ⚠ lineHeight 는 fontSize 의 1.35배 이상으로 유지할 것.
 *  안드로이드 RN 은 lineHeight 를 줄 높이 상한으로 강제해서, 값이 빠듯하면 한글 글자가
 *  위아래로 잘려 보인다. 게다가 호출부가 `{...dtype.label, fontSize: 14}` 처럼 fontSize 만
 *  덮어쓰는 경우가 많아(칩·카운트·라벨), 스케일이 큰 쪽을 기준으로 여유를 둬야 한다. */
//  ⚠️ 각 항목에 fontFamily 를 함께 박는다 — RN 커스텀 폰트는 fontWeight 로 굵어지지 않기 때문.
//     호출부가 `{...dtype.label, fontSize: 14}` 처럼 크기만 덮어써도 굵기·패밀리는 유지된다.
export const dtype = {
  display: { fontSize: 28, lineHeight: 38, fontWeight: "800" as const, fontFamily: PRETENDARD["800"] },
  titleL: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const, fontFamily: PRETENDARD["700"] },
  title: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const, fontFamily: PRETENDARD["700"] },
  cardTitle: { fontSize: 16, lineHeight: 23, fontWeight: "600" as const, fontFamily: PRETENDARD["600"] },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "400" as const, fontFamily: PRETENDARD["400"] },
  bodyS: { fontSize: 13.5, lineHeight: 20, fontWeight: "400" as const, fontFamily: PRETENDARD["400"] },
  meta: { fontSize: 12, lineHeight: 17, fontWeight: "500" as const, fontFamily: PRETENDARD["500"] },
  label: { fontSize: 12, lineHeight: 20, fontWeight: "700" as const, fontFamily: PRETENDARD["700"] },
} as const;

/**
 * 본문 조판(장문 읽기 전용) — 카드용 dtype 과 분리한다.
 * 카드는 15.5px 가 맞지만 장문은 17px 가 표준(브런치 17~19, 미디엄 21).
 * 좌우 20 + 17px 이면 한 줄이 약 19~20자 = 한글 장문에서 가장 읽기 좋은 구간(18~24자).
 * ⚠ lineHeight 는 fontSize 의 1.7배 이상 유지(한글 장문 기준). dtype 주석의 1.35 규칙보다 강하다.
 */
export const reading = {
  /** 본문 문단 */
  para: { fontSize: 17, lineHeight: 30, letterSpacing: -0.3, fontFamily: PRETENDARD["400"] },
  /** 본문 소제목 — 본문과 2px 차이면 구분이 안 된다. 크기 + 위 여백으로 띄운다. */
  heading: { fontSize: 19, lineHeight: 28, letterSpacing: -0.4, fontFamily: PRETENDARD["800"] },
  /** 목록 항목 */
  list: { fontSize: 17, lineHeight: 29, letterSpacing: -0.3, fontFamily: PRETENDARD["400"] },
  /** 문단 사이 간격 — 덩어리가 안 나뉘면 글이 벽처럼 보인다. */
  blockGap: 20,
  /** 소제목 위 추가 여백 */
  headingTop: 28,
  /** 본문 좌우 여백 */
  pagePadding: 20,
  /** 목록 들여쓰기 */
  listIndent: 16,
} as const;

/**
 * 난이도 배지 — **사람을 등급 매기지 않고 '글의 성격'을 말한다.**
 * "개발자용" 같은 라벨은 비개발자를 밀어내고, 빨강은 "깊은 글 = 나쁜 글"로 읽히게 만든다.
 * 그래서 빨강을 쓰지 않는다. 거르는 장치가 아니라 기대치를 맞추는 장치다.
 *
 * ⚠️ **색을 갖지 않는다.** 예전엔 난이도마다 파스텔을 줬는데, 그 파스텔이
 *    TOPIC_META 와 같은 팔레트라 카드 안에서 같은 분홍이 "디자인 글"이자
 *    "심화"가 됐다. 색의 의미가 깨진다(DESIGN_SYSTEM §1 — 주제 색은 의미 색으로만).
 *    카드에서 색을 쓰는 건 **주제 칩 하나뿐이다.**
 */
/**
 * ⚠️ 라벨은 **"개발 지식이 얼마나 필요한가"** 를 말한다.
 *    입문/보통/심화는 "글이 쉬운가 어려운가"로 읽혀서 애매했다. 이 서비스에 들어온
 *    기획자·디자이너·마케터가 알고 싶은 건 딱 하나 — **개발을 몰라도 읽히는가.**
 */
export const LEVEL_META: Record<ArticleLevel, { label: string; hint: string }> = {
  easy: {
    label: "누구나 이해 가능",
    hint: "배경지식 없이 읽을 수 있어요",
  },
  terms: {
    label: "기초 개발지식 필요",
    hint: "도메인 용어가 몇 개 나와요. 눌러서 뜻을 볼 수 있어요",
  },
  code: {
    label: "개발지식 필요",
    hint: "코드·구현 상세까지 들어가요",
  },
};

export const LEVEL_ORDER: ArticleLevel[] = ["easy", "terms", "code"];

/**
 * 원탭 스탬프 — 글을 다 읽고 버튼 하나만 누르는 반응.
 * 인사이트를 못 쓰는 다수에게서 큐레이션 데이터를 얻는 통로다.
 * 각 버튼이 뒤에서 하는 일:
 *   apply    → 큐레이션이 맞았는지 보는 신호(이 글이 도움이 됐다)
 *   reason   → 결정 카드가 잘 뽑힌 글인지 확인하는 신호
 *   disagree → "같이 읽는 글"에 넣기 좋은 논쟁적인 글
 *   hard     → 이 글에 용어 예고가 필요하다는 신호(단어장 연결)
 *
 * ⚠️ 라벨은 **읽은 사람의 말**로 쓴다. "우리도 써먹겠다"는 다짐이라 누르기 전에 한 번
 *    생각하게 만든다 — 탭 한 번짜리 반응에 그 무게를 얹으면 아무도 안 누른다.
 *    키(apply·reason·…)는 그대로 두고 문구만 바꾼다(쌓인 데이터를 잃지 않는다).
 */
export const STAMP_META: Record<StampKind, { icon: LucideIcon; label: string }> = {
  apply: { icon: ThumbsUp, label: "도움이 됐어요" },
  hard: { icon: HelpCircle, label: "용어가 어려웠어요" },
  disagree: { icon: MessageCircle, label: "반대 의견이 있어요" },
  reason: { icon: Sparkles, label: "인상적이었어요" },
};

export const STAMP_ORDER: StampKind[] = ["apply", "hard", "disagree", "reason"];

/**
 * 직무 — 온보딩에서 받고, 역할별 요약·직군 배지·단어장 개인화가 전부 이 값을 쓴다.
 * `summaryMode` 는 그 직무에게 기본으로 보여줄 AI 요약 관점.
 */
export const JOB_ROLE_META: Record<
  JobRole,
  { label: string; icon: LucideIcon; plural: string; summaryMode: "plain" | "planner" | "explain" }
> = {
  planner: { label: "기획", icon: ClipboardList, plural: "기획자", summaryMode: "planner" },
  designer: { label: "디자인", icon: Palette, plural: "디자이너", summaryMode: "planner" },
  marketer: { label: "마케팅", icon: Megaphone, plural: "마케터", summaryMode: "planner" },
  dev: { label: "개발", icon: Code, plural: "개발자", summaryMode: "plain" },
  data: { label: "데이터", icon: BarChart3, plural: "데이터 직군", summaryMode: "plain" },
  other: { label: "기타", icon: User, plural: "멤버", summaryMode: "explain" },
};

export const JOB_ROLE_ORDER: JobRole[] = [
  "planner",
  "designer",
  "marketer",
  "dev",
  "data",
  "other",
];

/** 수집 소스 성격 — 홈 로고 그리드를 "개발 글"만으로 보이지 않게 묶는 라벨. */
export const BLOG_KIND_META: Record<BlogKind, { label: string }> = {
  tech: { label: "기술" },
  design: { label: "디자인" },
  product: { label: "프로덕트" },
  culture: { label: "문화·브랜드" },
};

export const BLOG_KIND_ORDER: BlogKind[] = ["tech", "product", "design", "culture"];

/** 단어 도메인 라벨 — 마이 "자주 막히는 영역". */
export const WORD_DOMAIN_LABEL: Record<string, string> = {
  dev: "개발",
  infra: "인프라",
  data: "데이터",
  design: "디자인",
  marketing: "마케팅",
  product: "프로덕트",
  biz: "비즈니스",
};

/**
 * "무엇을 개선한 사례인가" 태그 — 글을 묶어 보는 축.
 *
 * 기존 TOPIC_META(개발·프로덕트·디자인…)는 **누가 쓴 글이냐**를 말한다.
 * 이건 **무엇을 개선했냐**를 말한다. 두 축을 나란히 둔다.
 *
 * ⚠️ 난이도 배지(LEVEL_META)를 대체한다. 난이도는 "용어가 나오는가"가 기준이었는데
 *    기술블로그 글은 거의 다 용어가 나와서 85%가 한 칸에 몰렸다(실측 82/96).
 *    변별력 없는 축은 화면만 어지럽힌다.
 */
export const IMPROVEMENT_META: Record<ImprovementType, { label: string; icon: LucideIcon }> = {
  ux: { label: "UI/UX 개선", icon: Palette },
  perf: { label: "성능 개선", icon: Zap },
  cost: { label: "비용 절감", icon: Wallet },
  reliability: { label: "장애·안정성", icon: ShieldCheck },
  devex: { label: "개발 생산성", icon: Wrench },
  data: { label: "데이터·실험", icon: BarChart3 },
  org: { label: "조직·프로세스", icon: Users },
  brand: { label: "브랜드·마케팅", icon: Megaphone },
};


/** 필터 칩 노출 순서 — 비개발자가 먼저 볼 것부터. */
export const IMPROVEMENT_ORDER: ImprovementType[] = [
  "ux",
  "brand",
  "org",
  "data",
  "reliability",
  "perf",
  "cost",
  "devex",
];

// ===== 아카이브 =====
/**
 * 아카이브 아이콘 — 사용자가 만든 보관함을 **한눈에 구분**하는 유일한 장치다.
 *   이름만으로는 그리드에서 다 비슷해 보여서, 생성 2단계(제목 → 아이콘)로 아이콘을 꼭 받는다.
 * ⚠️ 키는 DB(`archives.icon`)에 문자열로 저장된다 — 한 번 쓴 키는 지우지 말고 추가만 한다.
 *    없는 키가 오면 화면은 `ARCHIVE_ICON_FALLBACK` 으로 떨어진다(빈 칸 대신).
 */
export const ARCHIVE_ICONS: Record<string, { label: string; icon: LucideIcon; tint: string; ink: string }> = {
  all: { label: "전체", icon: Layers, tint: "#EDEBF5", ink: "#5B5470" },
  earth: { label: "지구·환경", icon: Sprout, tint: "#E3F5E8", ink: "#2F8A57" },
  world: { label: "정세·사회", icon: Landmark, tint: "#E7EEFB", ink: "#3762B8" },
  tech: { label: "기술·전기차", icon: Atom, tint: "#EAEAFB", ink: "#5145C4" },
  culture: { label: "문화·아이돌", icon: Gamepad2, tint: "#FBE9F2", ink: "#B8437C" },
  work: { label: "직장·커리어", icon: Briefcase, tint: "#FDF0E1", ink: "#B0762A" },
  money: { label: "돈·비즈니스", icon: Wallet, tint: "#E4F4F1", ink: "#2C8579" },
  design: { label: "디자인", icon: Palette, tint: "#FAEAF3", ink: "#B5457F" },
  idea: { label: "아이디어", icon: Lightbulb, tint: "#FCF3DE", ink: "#A9822A" },
};

export const ARCHIVE_ICON_ORDER: string[] = [
  "all",
  "earth",
  "world",
  "tech",
  "culture",
  "work",
  "money",
  "design",
  "idea",
];

export const ARCHIVE_ICON_FALLBACK = ARCHIVE_ICONS.all;

/** 없는 키·null 도 항상 무언가를 돌려준다 — 그리드에 빈 타일이 생기면 안 된다. */
export function archiveIcon(key: string | null | undefined) {
  return (key && ARCHIVE_ICONS[key]) || ARCHIVE_ICON_FALLBACK;
}

// ===== 읽기 흐름(글 상세) =====
/**
 * 단계 중요도 — 비개발자가 멈추는 이유는 "건너뛰어도 되나?"를 몰라서다. 그 답을 미리 준다.
 *   core = 이것만 읽어도 글이 이해된다(기본 펼침)
 *   ref  = 읽으면 좋지만 건너뛰어도 된다(접힘)
 *   dev  = 코드·설정값(접힘, 비개발자는 그냥 지나간다)
 * 색은 주지 않는다 — 주제칩(색)과 겹치면 카드에 색이 두 개가 된다. 라벨과 접힘 상태로만 말한다.
 */
export const STEP_WEIGHT_META: Record<string, { label: string; openByDefault: boolean }> = {
  core: { label: "핵심", openByDefault: true },
  ref: { label: "참고", openByDefault: false },
  dev: { label: "개발자용", openByDefault: false },
};
