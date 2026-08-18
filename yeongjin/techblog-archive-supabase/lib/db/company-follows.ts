import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 기업 좋아요(팔로우) — "좋아요한 기업의 새 글" 알림(PRD 2. 공통 UI)의 대상 목록을 정한다.
export type CompanyFollowRecord = {
  id: string;
  user_key: string;
  company: string;
  created_at: string;
};

export async function listFollowedCompanies(userKey: string): Promise<string[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("company_follows").select("company").eq("user_key", userKey);
    return ((data as { company: string }[]) ?? []).map((r) => r.company);
  }
  const items = await readCollection<CompanyFollowRecord>("company_follows");
  return items.filter((f) => f.user_key === userKey).map((f) => f.company);
}

export async function listUserKeysFollowingCompany(company: string): Promise<string[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase.from("company_follows").select("user_key").eq("company", company);
    return ((data as { user_key: string }[]) ?? []).map((r) => r.user_key);
  }
  const items = await readCollection<CompanyFollowRecord>("company_follows");
  return items.filter((f) => f.company === company).map((f) => f.user_key);
}

export async function toggleCompanyFollow(
  company: string,
  userKey: string,
): Promise<{ following: boolean }> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("company_follows")
      .select("id")
      .eq("company", company)
      .eq("user_key", userKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("company_follows").delete().eq("id", existing.id);
      return { following: false };
    }
    await supabase.from("company_follows").insert({ company, user_key: userKey });
    return { following: true };
  }

  const items = await readCollection<CompanyFollowRecord>("company_follows");
  const idx = items.findIndex((f) => f.company === company && f.user_key === userKey);
  if (idx >= 0) {
    items.splice(idx, 1);
    await writeCollection("company_follows", items);
    return { following: false };
  }
  items.push({ id: randomUUID(), user_key: userKey, company, created_at: new Date().toISOString() });
  await writeCollection("company_follows", items);
  return { following: true };
}
