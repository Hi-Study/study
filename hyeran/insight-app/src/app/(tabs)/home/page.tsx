import Link from "next/link";
import { getStats, type StatRow } from "@/lib/queries";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// 홈 = 수집·판정 현황판.
// 서비스를 쓰기 전에 "어떤 글이 올라오고 있나"를 먼저 파악하기 위한 화면이다.
// 각 줄은 피드로 이어져 그 묶음의 글을 실제로 읽어볼 수 있다.
function StatGroup({ title, note, rows, total }: { title: string; note?: string; rows: StatRow[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="stat-sec">
      <div className="stat-head">
        <h2>{title}</h2>
        {note && <span>{note}</span>}
      </div>
      <div className="stat-rows">
        {rows.map((r) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          const body = (
            <>
              <span className="sr-label">{r.label}</span>
              <span className="sr-bar"><i style={{ width: `${(r.count / max) * 100}%` }} /></span>
              <span className="sr-n">{r.count}</span>
              <span className="sr-p">{pct}%</span>
            </>
          );
          return r.href
            ? <Link key={r.label} href={r.href} className="stat-row">{body}</Link>
            : <div key={r.label} className="stat-row">{body}</div>;
        })}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const s = await getStats();
  const unjudged = s.total - s.judged;

  return (
    <>
      <div className="appbar">
        <span className="logo"><span className="name">INSIGHT</span><span className="dot">.</span></span>
        <span className="spacer" />
        <Link href="/search" className="iconbtn" aria-label="검색"><Icon name="search" /></Link>
        <Link href="/notifications" className="iconbtn" aria-label="알림"><Icon name="bell" /></Link>
      </div>
      <div className="pad">
        <div className="stat-top">
          <div><b>{s.total}</b><span>수집한 글</span></div>
          <div><b>{s.companies.length}</b><span>출처</span></div>
          <div><b>{s.judged}</b><span>판정 완료</span></div>
          {unjudged > 0 && <div className="warn"><b>{unjudged}</b><span>미판정</span></div>}
        </div>

        <StatGroup title="글의 성격" note="article_kind" rows={s.kinds} total={s.total} />
        {/* 사용자/내부 구분은 저장되는 값이 아니라 읽기 위한 묶음이다 */}
        <StatGroup
          title="다룬 문제 · 쓰는 사람"
          note={`${s.userProblems.reduce((n, r) => n + r.count, 0)}건 · 서비스를 쓰는 사람이 겪는 문제`}
          rows={s.userProblems}
          total={s.total}
        />
        <StatGroup
          title="다룬 문제 · 만드는 쪽"
          note={`${s.makerProblems.reduce((n, r) => n + r.count, 0)}건 · 만드는 팀이 겪는 문제`}
          rows={s.makerProblems}
          total={s.total}
        />
        <StatGroup title="어디에도 안 맞음" note="problem_type 없음" rows={[s.noProblem]} total={s.total} />
        <StatGroup title="무엇이 달라졌나" note="impact_targets · 복수" rows={s.impacts} total={s.total} />
        <StatGroup title="결과를 어떻게 말하나" note="result_certainty" rows={s.certainties} total={s.total} />
        <StatGroup title="부수 플래그" note="flags · 복수" rows={s.flags} total={s.total} />
        <StatGroup title="출처" note={`${s.companies.length}곳`} rows={s.companies} total={s.total} />

        <p className="stat-note" style={{ marginTop: 22 }}>
          각 줄을 누르면 그 묶음의 글만 볼 수 있어요.
        </p>
      </div>
    </>
  );
}
