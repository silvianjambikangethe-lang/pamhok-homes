import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("staff_members")
    .insert({ name })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Not authorized, or could not add worker." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
