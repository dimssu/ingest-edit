import type { DerivedOp } from "@/lib/db/models/Version";
import type { RenderJobPayload } from "@/lib/jobs/types";

/**
 * Pure helper that classifies a render payload into one of the
 * `Version.derivedFrom.op` values. The classification is "best-effort
 * descriptive" — it never affects the output bytes, just the label/op we
 * record on the resulting Version doc.
 *
 * Rules (pragmatic, kept simple):
 *
 *   1 clip, same source as `baseVersionId`, range is the full source
 *   duration → `original` (caller should reject as a no-op before we get
 *   here; we return `trim` defensively because we can't tell duration
 *   here).
 *
 *   1 clip, sub-range of any single source → `trim`.
 *
 *   ≥2 clips, all sharing the same `sourceVersionId` → `split` (the user
 *   sliced + reordered/dropped pieces of one source).
 *
 *   ≥2 clips, mixed sources, base appears in clips, AND base sits at
 *   either the very start or the very end of the timeline (i.e. base is
 *   contiguous and the non-base clips bookend it) → `append`.
 *
 *   Anything else with ≥2 clips → `concat`.
 */
export function classifyOp(payload: RenderJobPayload): DerivedOp {
  const { clips, baseVersionId } = payload;

  if (clips.length === 1) {
    return "trim";
  }

  const uniqueSources = new Set(clips.map((c) => c.sourceVersionId));
  if (uniqueSources.size === 1) {
    return "split";
  }

  // Mixed sources. Check whether the base run sits only at start/end.
  const baseAtStart = clips[0].sourceVersionId === baseVersionId;
  const baseAtEnd = clips[clips.length - 1].sourceVersionId === baseVersionId;
  const baseAppears = clips.some((c) => c.sourceVersionId === baseVersionId);

  if (baseAppears && (baseAtStart || baseAtEnd)) {
    // Verify base appears as a single contiguous run — otherwise it's a
    // concat with re-injected snippets of the base, which we call concat.
    let runs = 0;
    let inRun = false;
    for (const clip of clips) {
      const isBase = clip.sourceVersionId === baseVersionId;
      if (isBase && !inRun) {
        runs += 1;
        inRun = true;
      } else if (!isBase) {
        inRun = false;
      }
    }
    if (runs === 1) return "append";
  }

  return "concat";
}

/**
 * Default human-readable Version label when the user didn't provide one.
 */
export function defaultLabelFor(
  op: DerivedOp,
  payload: RenderJobPayload,
): string {
  const count = payload.clips.length;
  switch (op) {
    case "trim":
      return "Trim";
    case "split":
      return `Edit (${count} clips)`;
    case "append":
      return "Append";
    case "concat":
      return `Concat (${count} clips)`;
    case "audio-swap":
      return "Audio swap";
    case "audio-extract":
      return "Audio extract";
    case "original":
      return "Original";
    default:
      return "Edit";
  }
}
