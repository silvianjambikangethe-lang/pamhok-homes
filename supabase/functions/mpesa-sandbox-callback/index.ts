// TEMPORARY, throwaway — logs the raw body of whatever hits this URL, does
// nothing else (no DB writes). Exists purely so we can see the ACTUAL shape
// of a real Jenga STK-push sandbox callback (field names, a real `code`
// value, whether an amount field exists) before writing verification logic
// against it. Never touches bookings/guest_requests. Delete once Phase 1's
// callback-verification work is done.
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const bodyText = await req.text();
  console.log("mpesa-sandbox-callback raw body:", bodyText);
  console.log("mpesa-sandbox-callback headers:", JSON.stringify([...req.headers.entries()]));
  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
