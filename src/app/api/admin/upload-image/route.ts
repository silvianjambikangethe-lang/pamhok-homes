import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateFile(file: unknown): file is File {
  return (
    file instanceof File &&
    ALLOWED_TYPES.includes(file.type) &&
    file.size <= MAX_SIZE
  );
}

// Generic admin-only image upload for public site content (homepage hero,
// About Us photo, room photos). RLS on storage.objects — not this route —
// is what actually enforces "admin only": a signed-out request lands here
// with no admin session, the storage write is rejected, and we surface
// that as a normal error response.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const path = formData?.get("path");

  if (!validateFile(file)) {
    return NextResponse.json(
      { error: "Please upload a JPG, PNG, or WebP image (under 5MB)." },
      { status: 400 },
    );
  }
  if (typeof path !== "string" || !path.trim()) {
    return NextResponse.json({ error: "Missing upload path." }, { status: 400 });
  }

  const extension = file.name.split(".").pop() ?? "jpg";
  const objectPath = `${path}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("site-images")
    .upload(objectPath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: "Not authorized, or upload failed." },
      { status: 403 },
    );
  }

  const { data } = supabase.storage.from("site-images").getPublicUrl(objectPath);

  return NextResponse.json({ url: data.publicUrl });
}
