import fs from "node:fs";
import type { DetailV2 } from "../../src/core/1-analyze/detail-v2";

/** export-detail-v2-input 이 만든 한 줄 */
export type InputLine = { id: number; title: string; company: string; url: string; text: string };
/** Claude Code 가 만든 한 줄 */
export type OutputLine = { id: number; detail: DetailV2 };

/** JSONL 을 읽는다 — 줄마다 파싱 실패는 모아서 돌려준다 */
export function readJsonl<T>(file: string): { rows: T[]; errors: string[] } {
  const rows: T[] = [];
  const errors: string[] = [];
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        rows.push(JSON.parse(line) as T);
      } catch (e) {
        errors.push(`${i + 1}번째 줄 JSON 오류: ${(e as Error).message}`);
      }
    });
  return { rows, errors };
}

/**
 * data/detail-v2/allow-numbers.json — { "23": ["190"] } 처럼 글별로, 원문과 대조해 맞다고 확인한 숫자.
 * 원문 표현을 바꿔 쓴 경우(1.9 million → 190만, 서른아홉 → 39)를 통과시킨다. 없으면 빈 목록.
 */
export function allowNumbersFor(id: number): string[] {
  const file = "data/detail-v2/allow-numbers.json";
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string[]>)[String(id)] ?? [];
}

export const arg =(name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
