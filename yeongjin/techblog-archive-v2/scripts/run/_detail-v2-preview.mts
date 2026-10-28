import type { Learning } from "../../src/core/shared/types";

/** import-detail-v2 --dry 의 결과를 지금(v1) / v2 나란히 보는 HTML 로 만든다 — 혜란 님 검토용 */
export function previewHtml(items: { id: number; title: string; url: string; before: Learning; after: Learning }[]): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const side = (l: Learning, v2: boolean) => {
    const o = l.overview;
    const rows = o
      ? [
          [v2 ? "무엇을 했대요?" : "무슨 이야기야?", o.what],
          [v2 ? "왜 했대요?" : "왜 했어?", o.why],
          [v2 ? "어떻게 했대요?" : "어떻게 했어?", o.actions],
          [v2 ? "그래서 어떻게 됐대요?" : "어떤 결과가 있었어?", o.results],
        ]
          .map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`)
          .join("")
      : "<p class=muted>(요약 없음)</p>";
    const points = (o?.takeaways ?? []).map((t) => `<li>${e(t)}</li>`).join("");
    const concepts = (l.concepts ?? [])
      .map((c) => `<div class=concept><b>${e(c.term)}</b><p>${e(c.what)}</p><p class=why>${e(c.why)}</p></div>`)
      .join("");
    const tools = (l.tools ?? []).map((t) => `<li><b>${e(t.name)}</b> — ${e(t.description)}</li>`).join("");
    return `<dl>${rows}</dl>
      <h4>기획 포인트 ${o?.takeaways.length ?? 0}</h4><ul>${points}</ul>
      <h4>개념 ${l.concepts?.length ?? 0}</h4>${concepts || "<p class=muted>없음</p>"}
      ${v2 ? `<h4>도구·프로그램 ${l.tools?.length ?? 0}</h4>${tools ? `<ul>${tools}</ul>` : "<p class=muted>없음</p>"}` : ""}`;
  };
  const body = items
    .map(
      (x) => `<section><h2>#${x.id} <a href="${e(x.url)}" target=_blank>${e(x.title)}</a></h2>
      <div class=grid><div class=col><h3>지금 (v1)</h3>${side(x.before, false)}</div><div class="col v2"><h3>바뀔 내용 (v2)</h3>${side(x.after, true)}</div></div></section>`,
    )
    .join("");
  return `<!doctype html><html lang=ko><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>상세 v2 미리 보기</title>
<style>
body{font-family:Pretendard,system-ui,sans-serif;margin:0;padding:24px 16px;background:#f6f7f9;color:#1f2329;line-height:1.6}
main{max-width:1200px;margin:0 auto}h1{font-size:22px}section{background:#fff;border-radius:12px;padding:20px;margin:20px 0;box-shadow:0 1px 3px #0001}
h2{font-size:18px;margin:0 0 12px}h2 a{color:inherit}h3{font-size:15px;margin:0 0 8px}h4{font-size:13px;color:#555;margin:16px 0 6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:800px){.grid{grid-template-columns:1fr}}
.col{padding:14px;border-radius:8px;background:#f3f4f6}.v2{background:#eef6ff}
dt{font-weight:600;font-size:13px;color:#555}dd{margin:0 0 8px}ul{margin:0;padding-left:20px}li{margin:4px 0}
.concept{background:#fff8;border-radius:6px;padding:8px 10px;margin:6px 0}.concept p{margin:2px 0}.why{color:#555;font-size:14px}.muted{color:#999}
</style><main><h1>글 상세 v2 미리 보기 — ${items.length}건</h1><p class=muted>DB 는 아직 바뀌지 않았어요. 왼쪽이 지금, 오른쪽이 반영 후예요.</p>${body}</main></html>`;
}
