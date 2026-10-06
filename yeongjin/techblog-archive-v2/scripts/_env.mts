import fs from "node:fs";

/** 스크립트는 Next 밖에서 돌기 때문에 .env.local 을 직접 읽는다 */
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

export const log = (m: string) => console.log(m);
