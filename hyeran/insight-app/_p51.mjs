import fs from "node:fs";
const p = "src/components/FeedClient.tsx";
const raw = fs.readFileSync(p, "utf8"); const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("NOT FOUND: " + a.slice(0, 60)); s = s.replace(a, b); };

// 북마크는 전용 탭(/bookmarks)이 생겨 피드에서 중복이다
rep(`  initialTab = "all", initialSource = "all", initialClass,
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[];
  initialTab?: "all" | "bookmark"; initialSource?: string;`,
`  initialSource = "all", initialClass,
}: {
  posts: Post[]; companies: Company[]; bookmarked: string[]; readIds: string[];
  initialSource?: string;`);
rep(`  const [tab, setTab] = useState<"all" | "bookmark">(initialTab);\n`, ``);
rep(`  if (tab === "bookmark") list = list.filter((p) => bmSet.has(p.id));\n`, ``);
rep(`      <div className="utabs">
        <button className={\`utab \${tab === "all" ? "on" : ""}\`} onClick={() => setTab("all")}>전체</button>
        <button className={\`utab \${tab === "bookmark" ? "on" : ""}\`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>

`, ``);

fs.writeFileSync(p, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("✓ 피드 북마크 탭 제거");
