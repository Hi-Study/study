/**
 * 말랑한 블롭 모션 — 숨 쉬듯 모양이 바뀌는 그라데이션 덩어리. 얼굴·캐릭터는 없다(스펙 3절).
 * globals.css 의 ob-breathe/ob-float 키프레임을 쓴다(border-radius + transform 을 같이 애니메이션).
 */
export function Blob({
  className = "",
  variant = "float",
  from = "#ff8a68",
  to = "var(--brand)",
  delay = 0,
}: {
  className?: string;
  /** breathe = 제자리에서 숨만 쉰다(아이콘 배경용) · float = 떠다니며 숨 쉰다(장식용) */
  variant?: "breathe" | "float";
  from?: string;
  to?: string;
  /** 초 단위 — 같은 애니메이션을 쓰는 블롭끼리 박자가 안 겹치게 어긋나게 둔다 */
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      className={`${variant === "float" ? "ob-float" : "ob-breathe"} ${className}`}
      style={{ background: `radial-gradient(circle at 32% 28%, ${from}, ${to})`, animationDelay: `${delay}s` }}
    />
  );
}
