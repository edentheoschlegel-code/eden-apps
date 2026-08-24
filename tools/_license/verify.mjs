// Shared license-code verification for the Eden web tools.
// Verifies the SAME EDEN1 codes the Mac apps accept, offline, against the same
// ed25519 public key. No network, no backend. Works in the browser (Web Crypto
// Ed25519) and in Node (for testing).

// The public key baked into the Mac apps (licensing/license_public_key.pem),
// as the raw 32-byte Ed25519 key. Derived from the SPKI DER by dropping the
// 12-byte prefix "302a300506032b6570032100".
const SPKI_B64 = "MCowBQYDK2VwAyEA/QkY0kdoyvPMD0IH+B4fMA8Pwz7hBfE5moUqph9Sozk=";

function b64ToBytes(b64) {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// RFC 4648 base32 decode, no padding (matches Python base64.b32encode(...).rstrip("=")).
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("bad base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

const rawPubKey = () => b64ToBytes(SPKI_B64).slice(12); // drop SPKI prefix → 32 bytes

// Parse EDEN1-<PRODUCT>-<PAYLOAD>-<SIG>.
export function parseCode(raw) {
  const code = (raw || "").trim().toUpperCase();
  const m = code.match(/^EDEN1-([A-Z]+)-([A-Z2-7]+)-([A-Z2-7]+)$/);
  if (!m) return null;
  return { product: m[1].toLowerCase(), payloadB32: m[2], sigB32: m[3] };
}

// Verify a code's signature and (optionally) that it's valid for `appProduct`.
// A "bundle" code unlocks every app. Returns { ok, product, orderRef, date } or
// { ok:false, reason }.
export async function verifyCode(raw, appProduct) {
  const parsed = parseCode(raw);
  if (!parsed) return { ok: false, reason: "That doesn't look like a valid code." };
  let payload, sig;
  try {
    payload = base32Decode(parsed.payloadB32);
    sig = base32Decode(parsed.sigB32);
  } catch {
    return { ok: false, reason: "That code is malformed." };
  }
  const good = await ed25519Verify(sig, payload, rawPubKey());
  if (!good) return { ok: false, reason: "That code didn't check out." };

  // payload = "product|order_ref|YYYYMMDD"
  const text = new TextDecoder().decode(payload);
  const [product, orderRef, date] = text.split("|");
  // The product in the payload is authoritative (it was signed); the label in
  // the code is not. Accept the app's own product or a bundle code.
  if (appProduct && product !== appProduct && product !== "bundle") {
    return { ok: false, reason: `That code is for ${product}, not ${appProduct}.` };
  }
  return { ok: true, product, orderRef, date };
}

// Ed25519 verify — Web Crypto in the browser, Node crypto under test.
async function ed25519Verify(sig, msg, rawKey) {
  // Browser / modern runtimes with Web Crypto Ed25519.
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const key = await subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
      return await subtle.verify({ name: "Ed25519" }, key, sig, msg);
    } catch {
      /* fall through to Node path */
    }
  }
  // Node fallback (tests).
  if (typeof process !== "undefined") {
    const { verify, createPublicKey } = await import("node:crypto");
    // Rebuild an SPKI DER around the raw key so Node can import it.
    const der = new Uint8Array([
      0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00, ...rawKey,
    ]);
    const keyObj = createPublicKey({ key: Buffer.from(der), format: "der", type: "spki" });
    return verify(null, Buffer.from(msg), keyObj, Buffer.from(sig));
  }
  return false;
}
