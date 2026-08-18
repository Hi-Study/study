import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { toggleCompanyFollow } from "@/lib/db/company-follows";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ company: string }> },
) {
  const { company } = await params;

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    userKey = user.id;
  }

  const result = await toggleCompanyFollow(decodeURIComponent(company), userKey);
  return NextResponse.json(result);
}
