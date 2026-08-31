// distill 전용 토큰 — 주제(topic) 팔레트·문장 하이라이트 색·타입 스케일(DESIGN_GUIDE §2.4/§2.6/§3).
import type { Topic } from "@/types/database";

/** 고정 7주제: 라벨 + 글자색 + 칩 배경(tint). */
export const TOPIC_META: Record<Topic, { label: string; color: string; tint: string }> = {
  dev: { label: "개발", color: "#2F5FC9", tint: "#E9F0FB" },
  product: { label: "프로덕트", color: "#6E45C4", tint: "#F0EAFA" },
  design: { label: "디자인", color: "#C24A82", tint: "#FAE9F1" },
  planning: { label: "기획", color: "#C0842F", tint: "#FAF0E1" },
  data_ai: { label: "데이터/AI", color: "#4F46E5", tint: "#EEF0FE" },
  infra: { label: "인프라", color: "#2C9184", tint: "#E1F2EF" },
  career: { label: "커리어", color: "#3C9E79", tint: "#E4F3EC" },
};

export const TOPIC_ORDER: Topic[] = [
  "dev",
  "product",
  "design",
  "planning",
  "data_ai",
  "infra",
  "career",
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
export const dtype = {
  display: { fontSize: 28, lineHeight: 38, fontWeight: "800" as const },
  titleL: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const },
  title: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const },
  cardTitle: { fontSize: 16, lineHeight: 23, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "400" as const },
  bodyS: { fontSize: 13.5, lineHeight: 20, fontWeight: "400" as const },
  meta: { fontSize: 12, lineHeight: 17, fontWeight: "500" as const },
  label: { fontSize: 12, lineHeight: 20, fontWeight: "700" as const },
} as const;
