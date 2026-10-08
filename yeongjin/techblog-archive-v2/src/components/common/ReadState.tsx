"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { toggleIn, useLocalList } from "@/core/shared/local-store";

/**
 * 읽은 글 / 안 읽은 글 구분 — 글 상세를 열면 "읽음"이 된다(MarkRead). 기록은 이 브라우저에만 남는다.
 *
 * 카드(서버 화면)는 그대로 두고, 카드 안의 ReadBadge 가 읽은 글이면 data-read="true" 표시를 단다.
 * ReadFilter 는 감싼 목록에 data-read-filter 를 달고, CSS(globals.css)가 표시 유무로 카드를 숨긴다.
 */

export function ReadBadge({ id }: { id: number }) {
  const read = useLocalList<number>("read");
  if (!read.includes(id)) return null;
  return (
    <span data-read="true" className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
      ✓ 읽음
    </span>
  );
}

/* ── 필터 선택값 — 다음에 와도 유지 ── */
type Mode = "all" | "unread" | "read";
const MODE_KEY = "tbp:read-filter";
const MODE_EVENT = "read-filter-change";
function readMode(): Mode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "unread" || v === "read" ? v : "all";
  } catch {
    return "all";
  }
}
function setMode(m: Mode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* 저장 불가 — 이번 화면에서만 */
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}
function useMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(MODE_EVENT, cb);
      return () => window.removeEventListener(MODE_EVENT, cb);
    },
    readMode,
    () => "all",
  );
}

/**
 * 목록 위의 "전체 / 안 읽은 글 / 읽은 글" + 목록 감싸기
 * - ids: 개수를 셀 글 (감싼 목록 전체가 아니어도 된다 — 경험 페이지는 "함께 볼 글"을 빼고 센다)
 * - leading: 같은 줄 왼쪽에 둘 다른 필터 (있으면 읽음 필터는 작게, 오른쪽에)
 */
export function ReadFilter({
  ids,
  leading,
  children,
}: {
  ids: number[];
  leading?: React.ReactNode;
  children: React.ReactNode;
}) {
  const read = useLocalList<number>("read");
  const mode = useMode();
  const readCount = ids.filter((id) => read.includes(id)).length;
  const counts: Record<Mode, number> = { all: ids.length, unread: ids.length - readCount, read: readCount };
  const OPTIONS: { key: Mode; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "unread", label: "안 읽은 글" },
    { key: "read", label: "읽은 글" },
  ];

  const small = !!leading;
  const control = (
    <div
      role="radiogroup"
      aria-label="읽음 여부로 거르기"
      className={`inline-flex shrink-0 rounded-full bg-surface ring-1 ring-line ${small ? "gap-0.5 p-0.5" : "gap-1 p-1"}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={mode === o.key}
          onClick={() => setMode(o.key)}
          className={`rounded-full font-semibold transition ${small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
            mode === o.key ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
          <span className={`ml-1 font-normal ${small ? "text-[11px]" : "text-xs"} ${mode === o.key ? "text-white/60" : "text-ink-3"}`}>
            {counts[o.key]}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {leading ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {leading}
          {control}
        </div>
      ) : (
        control
      )}

      <div data-read-filter={mode} className="mt-3">
        {children}
      </div>

      {mode !== "all" && counts[mode] === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
          {mode === "unread" ? "이 목록의 글을 모두 읽었어요." : "아직 읽은 글이 없어요. 글을 열면 여기에 모여요."}
        </p>
      )}
    </div>
  );
}

/* ── 홈 "내가 읽은 글" ON/OFF — ON 이면 다 보이고(✓ 읽음 표시), OFF 면 읽은 글을 빼고 안 읽은 글로 채운다 ── */
const SHOW_KEY = "tbp:home-show-read";
const SHOW_EVENT = "home-show-read-change";
function readShow(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) !== "off";
  } catch {
    return true;
  }
}
export function useShowRead(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(SHOW_EVENT, cb);
      return () => window.removeEventListener(SHOW_EVENT, cb);
    },
    readShow,
    () => true,
  );
}
function setShow(on: boolean) {
  try {
    localStorage.setItem(SHOW_KEY, on ? "on" : "off");
  } catch {
    /* 저장 불가 — 이번 화면에서만 */
  }
  window.dispatchEvent(new Event(SHOW_EVENT));
}

/** 맨 위 고정 바(유틸리티 영역)의 알약 모양 전환 버튼 — 홈에서만 보인다 */
export function HomeReadToggle() {
  const on = useShowRead();
  const read = useLocalList<number>("read");
  if (usePathname() !== "/") return null;
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setShow(!on)}
      title={on ? "읽은 글도 함께 보여요" : "읽은 글은 빼고 보여요"}
      className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-sm font-bold transition ${
        on ? "bg-brand-soft text-brand" : "bg-[#e5e8eb] text-ink-2"
      }`}
    >
      <span className={`size-2 rounded-full ${on ? "bg-brand" : "bg-ink-3"}`} />
      내가 읽은 글{read.length > 0 && <span className="font-medium opacity-70">{read.length}</span>}
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-brand" : "bg-ink-3/50"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span className="sr-only">{on ? "켜짐" : "꺼짐"}</span>
    </button>
  );
}

/** 홈의 서버 화면(문제 카드 등)을 감싸 OFF 일 때 읽은 카드를 CSS 로 숨긴다 */
export function HomeReadScope({ children }: { children: React.ReactNode }) {
  const on = useShowRead();
  return <div data-read-filter={on ? "all" : "unread"}>{children}</div>;
}

/** 브라우저에서 그리는 목록(새 글 카드, 기술 탭) — OFF 면 읽은 글을 빼고 앞에서 n개 */
export function useUnreadFirst<T extends { id: number }>(items: T[], n: number): T[] {
  const on = useShowRead();
  const read = useLocalList<number>("read");
  return (on ? items : items.filter((i) => !read.includes(i.id))).slice(0, n);
}

/** 글 상세 — 읽음 / 안 읽음 직접 바꾸기 */
export function ReadToggle({ id }: { id: number }) {
  const read = useLocalList<number>("read");
  const on = read.includes(id);
  return (
    <button
      onClick={() => toggleIn("read", id)}
      aria-pressed={on}
      className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 transition hover:border-ink-3"
    >
      {on ? "✓ 읽음" : "안 읽음"}
    </button>
  );
}
