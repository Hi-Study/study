/**
 * 웹에서 **마우스로 가로 스크롤을 끌 수 있게** 한다.
 *
 * react-native-web 의 가로 ScrollView/FlatList 는 트랙패드나 Shift+휠로만 움직이고,
 * 마우스로 잡아끄는 건 안 된다. 폰에서는 손가락으로 당연히 되는 동작이라, 데스크톱 브라우저로
 * 시연하면 캐러셀·기업 로고 줄·칩 줄이 전부 "고장난 것처럼" 보인다(팀 시연 전에 받은 지적).
 *
 * 컴포넌트마다 고치지 않고 **문서 전체에 한 번** 붙인다 — 가로 스크롤은 홈·마이·필터·시리즈
 * 여러 곳에 있고, 새로 생기는 것까지 자동으로 덮여야 한다.
 *
 * 동작:
 *   · mousedown 한 자리에서 위로 올라가며 **가로로 넘치는 스크롤 상자**를 찾는다.
 *   · 5px 넘게 가로로 움직이면 끌기로 본다. 세로 움직임이 더 크면 끌기로 잡지 않는다
 *     (세로 스크롤을 뺏으면 안 된다).
 *   · 끄는 동안 scroll-snap 을 잠시 끈다 — 켜 둔 채 scrollLeft 를 바꾸면 카드가 튀며 따라온다.
 *   · 끌고 놓은 직후의 click 은 **한 번 삼킨다** — 안 그러면 카드를 끌었는데 상세로 열린다.
 *
 * ⚠️ 네이티브에서는 부르지 않는다(document 가 없다). App.tsx 가 Platform.OS === "web" 일 때만 부른다.
 */
const DRAG_THRESHOLD = 5;

function findHorizontalScroller(start: EventTarget | null): HTMLElement | null {
  let node = start as HTMLElement | null;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const scrolls = style.overflowX === "auto" || style.overflowX === "scroll";
    if (scrolls && node.scrollWidth > node.clientWidth + 1) return node;
    node = node.parentElement;
  }
  return null;
}

export function installWebDragScroll(): void {
  if (typeof document === "undefined") return;

  let target: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let dragging = false;
  let savedSnap = "";

  const swallowNextClick = () => {
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener("click", swallow, true);
    };
    document.addEventListener("click", swallow, true);
    // 클릭이 안 오는 경우(창 밖에서 놓음)에 대비해 잠시 뒤엔 풀어 준다.
    setTimeout(() => document.removeEventListener("click", swallow, true), 300);
  };

  const finish = () => {
    if (!target) return;
    const el = target;
    const wasDragging = dragging;
    target = null;
    dragging = false;
    el.style.cursor = "";
    document.body.style.userSelect = "";
    if (wasDragging) {
      // 스냅은 놓은 뒤 한 박자 있다가 되돌린다 — 바로 켜면 놓은 자리에서 한 번 더 튄다.
      setTimeout(() => {
        el.style.scrollSnapType = savedSnap;
      }, 50);
      swallowNextClick();
    }
  };

  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0) return;
      const el = findHorizontalScroller(e.target);
      if (!el) return;
      target = el;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.scrollLeft;
      dragging = false;
      savedSnap = el.style.scrollSnapType;
    },
    true,
  );

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!target) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // 세로로 끄는 중이다 — 가로 스크롤을 가로채지 않는다.
          target = null;
          return;
        }
        dragging = true;
        target.style.scrollSnapType = "none";
        target.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      target.scrollLeft = startLeft - dx;
      e.preventDefault();
    },
    true,
  );

  document.addEventListener("mouseup", finish, true);
  document.addEventListener("mouseleave", finish);
}
