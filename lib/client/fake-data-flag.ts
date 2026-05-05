/**
 * Tiny module so callers can check whether mock data is enabled without
 * statically importing the (much larger) mock-data module. Pair with a
 * dynamic `await import("@/lib/client/mock-data")` inside the branch so
 * webpack can split mock-data into its own chunk and skip shipping it to
 * production browsers.
 */

/** Reads `NEXT_PUBLIC_USE_FAKE_DATA` and forces it off in production builds. */
export function fakeDataEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_USE_FAKE_DATA === "1";
}
