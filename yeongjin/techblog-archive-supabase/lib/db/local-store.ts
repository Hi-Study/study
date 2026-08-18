import { promises as fs } from "fs";
import path from "path";

// Supabase 없이도 로컬에서 기능을 테스트할 수 있게 만든 임시 파일 저장소다.
// 배포 전 반드시 실제 Supabase 테이블(DATA_BACKEND=supabase)로 되돌려야 한다.
const DATA_DIR = path.join(process.cwd(), ".local-data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readCollection<T>(name: string): Promise<T[]> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(items, null, 2), "utf-8");
}
