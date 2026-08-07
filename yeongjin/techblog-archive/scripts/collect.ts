import "dotenv/config";
import { crawlAllCompanies } from "../src/lib/crawler";

async function main() {
  console.log("RSS 자동 수집 시작...");
  const results = await crawlAllCompanies();
  for (const r of results) {
    console.log(`- ${r.company}: fetched=${r.fetched} created=${r.created} skipped=${r.skipped}`);
    r.errors.forEach((e) => console.log(`  ! ${e}`));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
