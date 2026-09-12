import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);

// Re-encodes an already-uploaded video in place, in the "site-videos"
// bucket, and overwrites it with a smaller version -- same public URL,
// same admin-content flow (VideoUploadField/VideoListField call this
// right after their direct-to-Storage upload completes). Deliberately
// NOT combined with the upload itself: the raw file goes browser ->
// Supabase directly specifically to dodge Vercel's ~4.5MB request-body
// cap, so this route only ever receives a small JSON body (the object
// path) and fetches the actual video bytes itself server-side -- an
// outbound fetch has no such body-size limit, only inbound requests do.
//
// -crf 28 (vs. 18-23 "visually lossless") is a deliberately aggressive
// but still web-acceptable setting for short promotional clips, not a
// quality-preserving transcode -- the point here is file size. Width is
// capped at 720px (portrait short-form video rarely benefits from more
// on a phone screen) without upscaling anything already smaller.
// +faststart moves the MP4 moov atom to the front so playback can start
// before the whole file has downloaded, a real speed win independent of
// file size.
export const maxDuration = 60;

export async function POST(request: Request) {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { data: adminRow } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  if (!ffmpegPath) {
    return NextResponse.json({ error: "Video compression is not available." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const objectPath = typeof body?.objectPath === "string" ? body.objectPath : null;
  if (!objectPath || objectPath.includes("..") || objectPath.length > 200) {
    return NextResponse.json({ error: "Missing or invalid object path." }, { status: 400 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: downloadData, error: downloadError } = await adminClient.storage
    .from("site-videos")
    .download(objectPath);
  if (downloadError || !downloadData) {
    return NextResponse.json({ error: "Could not find the uploaded video." }, { status: 404 });
  }

  const originalBytes = Buffer.from(await downloadData.arrayBuffer());
  const originalSize = originalBytes.length;

  const workDir = await mkdtemp(path.join(tmpdir(), "vid-"));
  const inputPath = path.join(workDir, "input.mp4");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    await writeFile(inputPath, originalBytes);

    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale='min(720,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const compressedBytes = await readFile(outputPath);
    const compressedSize = compressedBytes.length;

    // Only replace the original if compression actually helped -- a
    // very short/already-compressed clip can occasionally come out
    // larger after re-encoding, and there's no reason to keep a worse
    // file just because a compression step ran.
    if (compressedSize < originalSize) {
      const { error: uploadError } = await adminClient.storage
        .from("site-videos")
        .update(objectPath, compressedBytes, { contentType: "video/mp4", upsert: true });
      if (uploadError) {
        return NextResponse.json({ error: "Could not save compressed video." }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      originalSize,
      compressedSize: Math.min(compressedSize, originalSize),
    });
  } catch {
    // Compression failing shouldn't be treated as the upload itself
    // failing -- the original file is already safely stored. Report ok
    // with no size change so the caller can proceed with the
    // already-working original.
    return NextResponse.json({ ok: true, originalSize, compressedSize: originalSize });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
