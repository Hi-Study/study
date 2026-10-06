/**
 * 0단계 — 회사 로고 경로. `npm run fetch-logos` 가 public/logos/<회사id>.<확장자> 로 받아 둔 파일을 찾는다.
 * 로고는 각 회사의 상표라 저장소에 올리지 않는다(.gitignore). 파일이 없으면 null → 화면이 회사 이름 첫 글자로 대신한다.
 * 서버에서만 쓴다(파일 시스템을 읽는다).
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "logos");

export function companyLogo(id: string): string | null {
  try {
    const file = fs.readdirSync(DIR).find((f) => f.replace(/\.[^.]+$/, "") === id);
    return file ? `/logos/${file}` : null;
  } catch {
    return null; // 로고 폴더가 아직 없다
  }
}
