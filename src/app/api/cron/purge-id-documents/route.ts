import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { completeCheckout } from "@/lib/checkout";
import { isStayOver } from "@/lib/stay-expiry";

// The privacy policy promises ID photos are deleted once the stay is over.
// The guest's own Check Out button does that (see completeCheckout), but a
// guest who never taps it, or a booking that was cancelled, or a file that
// nothing references any more (a replaced upload, a half-finished upload,
// a deleted booking) would keep an ID photo forever. This job closes all
// three gaps. Add ?dryRun=1 to see what it WOULD delete without deleting.
// Same auth pattern as the other cron routes, see checkout-reminders.

const BUCKET = "id-documents";
// An upload and the booking update that references it happen in one request,
// so anything unreferenced for a day is genuinely orphaned, not in progress.
const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const REMOVE_CHUNK = 100;

function isAuthorized(request: Request): boolean {
  // Fail closed, not open.
  if (!process.env.CRON_SECRET) return false;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  return request.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

type Admin = ReturnType<typeof createAdminSupabaseClient>;

const PATH_COLUMNS =
  "id_document_path, id_document_back_path, id_document_path_2, id_document_back_path_2";
const HAS_ANY_PATH =
  "id_document_path.not.is.null,id_document_back_path.not.is.null,id_document_path_2.not.is.null,id_document_back_path_2.not.is.null";

async function removeFiles(supabase: Admin, paths: string[]) {
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + REMOVE_CHUNK));
  }
}

// Every file in the bucket: files live in one folder per booking id.
async function listBucketFiles(supabase: Admin) {
  const files: { path: string; createdAt: number }[] = [];

  async function listFolder(prefix: string) {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset });
      if (!data || data.length === 0) return;
      for (const entry of data) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await listFolder(fullPath);
        } else {
          files.push({ path: fullPath, createdAt: Date.parse(entry.created_at ?? "") || 0 });
        }
      }
      if (data.length < 1000) return;
    }
  }

  await listFolder("");
  return files;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const supabase = createAdminSupabaseClient();
  const today = format(new Date(), "yyyy-MM-dd");
  // One full day after the check-out date before we treat a stay as over.
  const endedBefore = format(addDays(new Date(), -1), "yyyy-MM-dd");

  // 0. Paid stays past the check-out cutoff that nobody closed out (the guest
  // never tapped Check Out and nobody opened their page or pass): check
  // them out now, which also deletes their ID photos and phone number.
  const { data: unclosed } = await supabase
    .from("bookings")
    .select("id, check_out, checked_out_at")
    .is("checked_out_at", null)
    .is("pending_extension_check_out", null)
    .eq("payment_status", "Paid")
    .neq("booking_status", "Cancelled")
    .lte("check_out", today);
  let autoCheckedOut = 0;
  if (!dryRun) {
    for (const b of unclosed ?? []) {
      if (!isStayOver(b)) continue;
      const outcome = await completeCheckout(supabase, { bookingId: b.id });
      if (outcome.ok) autoCheckedOut++;
    }
  }

  // 1. Bookings that are over (or cancelled) but still hold ID photos.
  // A booking with a pending extension is skipped: the guest may still be
  // in the room waiting to pay for more nights.
  const { data: finished } = await supabase
    .from("bookings")
    .select(`id, guest_id, ${PATH_COLUMNS}`)
    .or(HAS_ANY_PATH)
    .or(`checked_out_at.not.is.null,booking_status.eq.Cancelled,check_out.lt.${endedBefore}`)
    .is("pending_extension_check_out", null);

  const endedStays = finished ?? [];
  const endedPaths: string[] = [];
  for (const b of endedStays) {
    for (const p of [
      b.id_document_path,
      b.id_document_back_path,
      b.id_document_path_2,
      b.id_document_back_path_2,
    ]) {
      if (p) endedPaths.push(p);
    }
  }

  let phonesWiped = 0;
  if (!dryRun && endedStays.length > 0) {
    await removeFiles(supabase, endedPaths);
    await supabase
      .from("bookings")
      .update({
        id_document_path: null,
        id_document_back_path: null,
        id_document_path_2: null,
        id_document_back_path_2: null,
      })
      .in("id", endedStays.map((b) => b.id));

    // The policy also deletes the phone number after the stay. The same
    // guest row can be shared (group bookings, returning guests), so only
    // wipe it when that guest has no other live booking.
    const guestIds = [...new Set(endedStays.map((b) => b.guest_id).filter((g): g is string => !!g))];
    for (const guestId of guestIds) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("guest_id", guestId)
        .is("checked_out_at", null)
        .neq("booking_status", "Cancelled")
        .gte("check_out", today);
      if ((count ?? 0) === 0) {
        await supabase.from("guests").update({ phone: null }).eq("id", guestId);
        phonesWiped++;
      }
    }
  }

  // 2. Files in the bucket that no booking points at any more.
  const { data: referencing } = await supabase
    .from("bookings")
    .select(PATH_COLUMNS)
    .or(HAS_ANY_PATH);
  const referenced = new Set<string>();
  for (const b of referencing ?? []) {
    for (const p of [
      b.id_document_path,
      b.id_document_back_path,
      b.id_document_path_2,
      b.id_document_back_path_2,
    ]) {
      if (p) referenced.add(p);
    }
  }
  // In a dry run nothing was released in step 1, so treat those as taken.
  if (dryRun) for (const p of endedPaths) referenced.add(p);

  const now = Date.now();
  const orphans = (await listBucketFiles(supabase))
    .filter((f) => !referenced.has(f.path) && now - f.createdAt > ORPHAN_MIN_AGE_MS)
    .map((f) => f.path);

  if (!dryRun && orphans.length > 0) await removeFiles(supabase, orphans);

  return NextResponse.json({
    ok: true,
    dryRun,
    autoCheckedOut,
    endedStays: { bookings: endedStays.length, files: endedPaths.length },
    orphanedFiles: orphans.length,
    phonesWiped,
    ...(dryRun ? { wouldDeleteSample: [...endedPaths, ...orphans].slice(0, 100) } : {}),
  });
}
