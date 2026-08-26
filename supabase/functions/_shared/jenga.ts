// Jenga/Finserve API v3 request-signing helper.
// UNCONFIRMED against a live sandbox call — see mpesa-initiate/index.ts for
// the full list of assumptions this integration makes.

// Strips everything except valid base64 characters (rather than trusting
// exact BEGIN/END line matches + whitespace stripping alone) — resilient
// to however the key got mangled when pasted into a secrets form:
// stray \r, smart quotes, literal "\n" instead of real newlines, extra
// wrapping quotes, etc. Found necessary in practice (2026-08-26): the
// original whitespace-only stripping threw "invalid character" on a real
// pasted key even though it looked correct.
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]*-----/, "")
    .replace(/-----END [^-]*-----/, "")
    // Literal backslash-n / backslash-r (two real characters, not an actual
    // newline) can end up in a secret's value depending on how it passed
    // through a form/shell — strip these BEFORE the base64 filter below,
    // otherwise the bare "n"/"r" letters get kept as if they were real
    // base64 data and silently corrupt the decoded key bytes.
    .replace(/\\[nr]/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;

async function getPrivateKey(pem: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

// Signs per Jenga's documented scheme: SHA-256 the payload, sign the hash
// with the RSA private key, Base64-encode the result (RSASSA-PKCS1-v1_5
// hashes internally, so the raw payload is passed straight to subtle.sign).
//
// Expects a PKCS8 PEM private key. Jenga's own key-generation instructions
// produce the older PKCS1 format ("BEGIN RSA PRIVATE KEY") that Deno's Web
// Crypto API can't import directly — convert it first:
//   openssl pkcs8 -topk8 -nocrypt -in private_key.pem -out private_pkcs8.pem
export async function signJenga(payload: string, privateKeyPem: string): Promise<string> {
  const key = await getPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
