/**
 * Client-side mirror of the server URL validator. The canonical validator
 * lives at `lib/ingest/instagram.ts` and runs again on the server — this
 * copy exists only to give the user instant feedback while they paste,
 * without a network round-trip.
 *
 * Keep the rules in sync if the server-side ever evolves.
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

  const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) {
    return { ok: false, reason: "bad path" };
  }
  const first = segments[0]?.toLowerCase() ?? "";
  if (!ALLOWED_FIRST_SEGMENTS.has(first)) {
    return { ok: false, reason: "bad path" };
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  return { ok: true, url: parsed.toString() };
}

/** Human-friendly explanation for each failure reason. */
export function describeValidationFailure(
  reason: ValidationFailureReason,
): string {
  switch (reason) {
    case "malformed":
      return "That doesn't look like a valid URL.";
    case "bad scheme":
      return "Use an https:// link.";
    case "bad host":
      return "Only instagram.com links are supported.";
    case "bad path":
      return "Paste a link to a reel, post, or IGTV video.";
  }
}
