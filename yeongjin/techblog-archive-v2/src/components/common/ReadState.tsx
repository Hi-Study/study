"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { toggleIn, useLocalList } from "@/core/shared/local-store";

/**
 * 읽은 글 / 안 읽은 글 구분 — 글 상세를 열면 "읽음"이 된다(MarkRead). 로그인한 계정에 저장된다(local-store.ts · AccountSync).
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

/* ── 홈·피드 "읽은 글 포함" ON/OFF — 기본은 켜짐(전부 보이고 ✓ 읽음 표시). 끄면 읽은 글을 빼고 안 읽은 글로 채운다 ──
   2026-11-12 워딩 "읽은 글 빼기" → "읽은 글 포함"(스위치 켜짐 = 포함). 저장 이름도 새로 — 예전에 "빼기"를 켜 둔 브라우저도
   모두 기본값(포함 켜짐)에서 다시 시작한다. 저장 값: "off" 일 때만 읽은 글을 뺀다 */
const HIDE_KEY = "tbp:include-read";
const HIDE_EVENT = "include-read-change";
const OLD_KEYS = ["tbp:home-hide-read", "tbp:home-show-read"];
function readShow(): boolean {
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k)); // 예전 이름으로 남은 설정 정리
    return localStorage.getItem(HIDE_KEY) !== "off";
  } catch {
    return true;
  }
}
/** true = 읽은 글도 보인다(기본) */
export function useShowRead(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(HIDE_EVENT, cb);
      return () => window.removeEventListener(HIDE_EVENT, cb);
    },
    readShow,
    () => true,
  );
}
function setShow(show: boolean) {
  try {
    localStorage.setItem(HIDE_KEY, show ? "on" : "off");
  } catch {
    /* 저장 불가 — 이번 화면에서만 */
  }
  window.dispatchEvent(new Event(HIDE_EVENT));
}

/** 로그아웃할 때 — "읽은 글 포함"도 기본값(켜짐)으로 돌린다. 다음 사람(또는 다음 로그인)은 전체 보기부터 */
export function resetHideRead() {
  try {
    localStorage.removeItem(HIDE_KEY);
  } catch {}
  window.dispatchEvent(new Event(HIDE_EVENT));
}

/** 이 스위치가 보이는 화면 — 홈·피드 (설정 하나를 같이 쓴다) */
const TOGGLE_PATHS = ["/", "/feed"];

/** 맨 위 고정 바(유틸리티 영역)의 알약 모양 전환 버튼 — 홈·피드에서만 보인다 */
export function HomeReadToggle() {
  const show = useShowRead();
  if (!TOGGLE_PATHS.includes(usePathname())) return null;
  return (
    <button
      role="switch"
      aria-checked={show}
      onClick={() => setShow(!show)}
      title={show ? "끄면 읽은 글을 빼고 보여요" : "읽은 글은 빼고 보여요"}
      className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-sm font-bold transition ${
        show ? "bg-brand-soft text-brand" : "bg-[#e5e8eb] text-ink-2"
      }`}
    >
      읽은 글 포함
      <span className={`relative h-5 w-9 rounded-full transition ${show ? "bg-brand" : "bg-ink-3/50"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${show ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span className="sr-only">{show ? "켜짐" : "꺼짐"}</span>
    </button>
  );
}

/** 홈·피드의 서버 화면(카드 목록)을 감싸 "읽은 글 포함"이 꺼졌을 때 읽은 카드를 CSS 로 숨긴다.
 *  ids 를 주면(피드) 다 읽어서 남은 글이 없을 때 안내를 보여 준다 */
export function HomeReadScope({ ids, children }: { ids?: number[]; children: React.ReactNode }) {
  const on = useShowRead();
  const read = useLocalList<number>("read");
  const allRead = !on && !!ids && ids.length > 0 && ids.every((id) => read.includes(id));
  return (
    <div data-read-filter={on ? "all" : "unread"}>
      {children}
      {allRead && (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
          이 목록의 글을 모두 읽었어요. 위의 “읽은 글 포함”을 켜면 다시 보여요.
        </p>
      )}
    </div>
  );
}

/** 브라우저에서 그리는 목록(새 글 카드, 기술 탭) — "읽은 글 포함"이 꺼지면 읽은 글을 빼고 앞에서 n개 */
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
