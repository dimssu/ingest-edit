/**
 * Pure formatting helpers used across client surfaces. No locale flags so
 * everything renders consistently on the server pre-hydration.
 */

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 30 * MS_PER_DAY;
const MS_PER_YEAR = 365 * MS_PER_DAY;

/** Formats a duration in milliseconds as `m:ss` or `h:mm:ss`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";

  const totalSeconds = Math.round(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Compact "n unit ago" string. Returns "just now" under 30 seconds. */
export function formatRelativeTime(input: string | Date | number): string {
  const target = input instanceof Date ? input : new Date(input);
  const ts = target.getTime();
  if (!Number.isFinite(ts)) return "";

  const diff = Date.now() - ts;
  if (diff < 30 * MS_PER_SECOND) return "just now";
  if (diff < MS_PER_MINUTE) return `${Math.round(diff / MS_PER_SECOND)}s ago`;
  if (diff < MS_PER_HOUR) {
    const m = Math.round(diff / MS_PER_MINUTE);
    return `${m}m ago`;
  }
  if (diff < MS_PER_DAY) {
    const h = Math.round(diff / MS_PER_HOUR);
    return `${h}h ago`;
  }
  if (diff < MS_PER_WEEK) {
    const d = Math.round(diff / MS_PER_DAY);
    return `${d}d ago`;
  }
  if (diff < MS_PER_MONTH) {
    const w = Math.round(diff / MS_PER_WEEK);
    return `${w}w ago`;
  }
  if (diff < MS_PER_YEAR) {
    const months = Math.round(diff / MS_PER_MONTH);
    return `${months}mo ago`;
  }
  const years = Math.round(diff / MS_PER_YEAR);
  return `${years}y ago`;
}

/** Returns the hostname of a URL, or the raw string if it won't parse. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Truncates a URL to a fixed length with an ellipsis in the middle. */
export function truncateMiddle(value: string, max = 56): string {
  if (value.length <= max) return value;
  const keep = Math.floor((max - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(value.length - keep)}`;
}
