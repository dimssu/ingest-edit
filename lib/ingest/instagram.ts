/**
 * SSRF guard + URL normalizer for Instagram source URLs. Run on every input
 * before it touches yt-dlp / the network.
 */

export type ValidationFailureReason =
  | "malformed"
  | "bad scheme"
  | "bad host"
  | "bad path";

export type InstagramUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: ValidationFailureReason };

const ALLOWED_HOSTS = ["instagram.com", "instagr.am"] as const;

/**
 * First-segment whitelist for Instagram public content. Permissive within
 * the allowed hosts but explicit about what we accept so unrelated paths
 * (`/accounts/login`, etc.) are rejected before yt-dlp is invoked.
 *
 * `/stories/*` deliberately excluded — they require authenticated access
 * yt-dlp can't reliably get from cookies alone.
 */
const ALLOWED_FIRST_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "share",
  "s",
]);

function hostIsAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const allowed of ALLOWED_HOSTS) {
    if (host === allowed) return true;
    if (host.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

/**
 * Returns `{ ok: true, url }` with a normalized https URL on success, or
 * `{ ok: false, reason }` on the first failed check. Never throws.
 */
export function validateInstagramUrl(input: string): InstagramUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "bad scheme" };
  }

  if (!hostIsAllowed(parsed.hostname)) {
    return { ok: false, reason: "bad host" };
  }

  // Path validation: drop empty segments, then check the first.
  const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) {
    return { ok: false, reason: "bad path" };
  }
  const first = segments[0]?.toLowerCase() ?? "";
  if (!ALLOWED_FIRST_SEGMENTS.has(first)) {
    return { ok: false, reason: "bad path" };
  }

  // Normalize: lowercased host, https, no trailing fragment.
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  return { ok: true, url: parsed.toString() };
}
