/**
 * Pure data model + helpers for the timeline editor's edit spec.
 *
 * The edit spec is an ordered list of clips, each one a windowed slice
 * (`startMs` .. `endMs`) of a source `VersionSummary`. Every helper here is
 * a pure function — no React, no DOM, no globals — so the reducer that
 * powers `EditSpecContext` can call them freely and they're trivial to
 * unit-test once a test runner lands.
 *
 * Naming convention:
 *   - "global ms" = position on the composed timeline (sum of clip
 *     durations from index 0).
 *   - "local ms" = position inside a single source video, i.e. `clip.startMs`
 *     .. `clip.endMs` on `clip.sourceVersionId`'s underlying file.
 */
export interface EditSpecClip {
  id: string;
  sourceVersionId: string;
  label: string;
  sourceDurationMs: number;
  startMs: number;
  endMs: number;
}

export interface EditSpec {
  baseVersionId: string;
  clips: EditSpecClip[];
}

export interface ClipAtResult {
  clip: EditSpecClip;
  index: number;
  /** Offset inside the clip's local source range (ms past `clip.startMs`). */
  localOffsetMs: number;
  /** Where this clip starts on the global timeline. */
  globalStartMs: number;
}

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Length of a single clip in ms. */
export function clipDurationMs(clip: EditSpecClip): number {
  return Math.max(0, clip.endMs - clip.startMs);
}

/** Sum of all clip durations. */
export function totalDurationMs(spec: EditSpec): number {
  let total = 0;
  for (const c of spec.clips) total += clipDurationMs(c);
  return total;
}

/**
 * Resolves which clip contains the given global ms position.
 *
 * Boundary rule: a position exactly on a clip boundary belongs to the LATER
 * clip, except at the very end of the timeline where it belongs to the last
 * clip — that way the playhead at the exact end still has a clip to "be in".
 */
export function clipAtGlobalMs(
  spec: EditSpec,
  globalMs: number,
): ClipAtResult | null {
  if (spec.clips.length === 0) return null;
  if (globalMs < 0) return null;

  let cursor = 0;
  for (let i = 0; i < spec.clips.length; i++) {
    const clip = spec.clips[i];
    const dur = clipDurationMs(clip);
    const clipEnd = cursor + dur;
    // Last clip absorbs the trailing edge.
    const isLast = i === spec.clips.length - 1;
    const inside = isLast
      ? globalMs >= cursor && globalMs <= clipEnd
      : globalMs >= cursor && globalMs < clipEnd;
    if (inside) {
      return {
        clip,
        index: i,
        localOffsetMs: Math.max(0, globalMs - cursor),
        globalStartMs: cursor,
      };
    }
    cursor = clipEnd;
  }
  return null;
}

/** Generates a stable-enough id for newly created clips. */
function nextClipId(spec: EditSpec, hint: string): string {
  // Deterministic from existing ids so the same operation produces the same
  // id given the same input — easier to reason about in dev. We append a
  // counter until unique.
  const taken = new Set(spec.clips.map((c) => c.id));
  let n = 1;
  while (taken.has(`${hint}_${n}`)) n++;
  return `${hint}_${n}`;
}

/**
 * Splits the clip at the given global ms into two adjacent clips.
 * No-op (returns the same spec) if the position falls exactly on a clip
 * boundary or sits outside the timeline.
 */
export function splitClipAtGlobalMs(spec: EditSpec, globalMs: number): EditSpec {
  const hit = clipAtGlobalMs(spec, globalMs);
  if (!hit) return spec;

  const localCutMs = hit.clip.startMs + hit.localOffsetMs;
  // Refuse degenerate splits — exactly on a boundary produces an empty clip.
  if (localCutMs <= hit.clip.startMs) return spec;
  if (localCutMs >= hit.clip.endMs) return spec;

  const left: EditSpecClip = {
    ...hit.clip,
    id: hit.clip.id,
    endMs: localCutMs,
  };
  const right: EditSpecClip = {
    ...hit.clip,
    id: nextClipId(spec, `${hit.clip.id}_b`),
    startMs: localCutMs,
  };

  const next = spec.clips.slice();
  next.splice(hit.index, 1, left, right);
  return { ...spec, clips: next };
}

/**
 * Removes the global range `[startMs, endMs)` from the timeline.
 * Clips fully covered by the range are dropped. Clips partially covered
 * are trimmed; a clip straddling the entire range is split into two
 * non-adjacent pieces.
 */
export function removeRangeMs(
  spec: EditSpec,
  startMs: number,
  endMs: number,
): EditSpec {
  if (endMs <= startMs) return spec;
  if (spec.clips.length === 0) return spec;

  const out: EditSpecClip[] = [];
  let cursor = 0;
  for (let i = 0; i < spec.clips.length; i++) {
    const clip = spec.clips[i];
    const dur = clipDurationMs(clip);
    const clipGlobalStart = cursor;
    const clipGlobalEnd = cursor + dur;
    cursor = clipGlobalEnd;

    // Clip entirely outside the cut → keep as-is.
    if (clipGlobalEnd <= startMs || clipGlobalStart >= endMs) {
      out.push(clip);
      continue;
    }

    const cutGlobalStart = Math.max(clipGlobalStart, startMs);
    const cutGlobalEnd = Math.min(clipGlobalEnd, endMs);

    // Local positions inside the source video.
    const localCutStart =
      clip.startMs + (cutGlobalStart - clipGlobalStart);
    const localCutEnd = clip.startMs + (cutGlobalEnd - clipGlobalStart);

    // Left fragment (before the cut).
    if (cutGlobalStart > clipGlobalStart) {
      out.push({
        ...clip,
        id: clip.id,
        endMs: localCutStart,
      });
    }
    // Right fragment (after the cut).
    if (cutGlobalEnd < clipGlobalEnd) {
      // Preserve a unique id when both fragments survive.
      const idHint =
        cutGlobalStart > clipGlobalStart ? `${clip.id}_tail` : clip.id;
      const newId =
        cutGlobalStart > clipGlobalStart
          ? nextClipIdForList(out.concat(spec.clips.slice(i + 1)), idHint)
          : clip.id;
      out.push({
        ...clip,
        id: newId,
        startMs: localCutEnd,
      });
    }
    // Both fragments fully covered → drop the clip entirely.
  }

  return { ...spec, clips: out };
}

// Internal helper: like nextClipId but operates on an arbitrary clip list.
function nextClipIdForList(clips: EditSpecClip[], hint: string): string {
  const taken = new Set(clips.map((c) => c.id));
  let n = 1;
  while (taken.has(`${hint}_${n}`)) n++;
  return `${hint}_${n}`;
}

/** Appends a new clip to the end of the timeline. */
export function appendClip(spec: EditSpec, clip: EditSpecClip): EditSpec {
  return { ...spec, clips: [...spec.clips, clip] };
}

/** Removes a clip by id. No-op if id isn't present. */
export function removeClip(spec: EditSpec, clipId: string): EditSpec {
  const next = spec.clips.filter((c) => c.id !== clipId);
  if (next.length === spec.clips.length) return spec;
  return { ...spec, clips: next };
}

/** Moves a clip up or down in the order. No-op if at the relevant boundary. */
export function moveClip(
  spec: EditSpec,
  clipId: string,
  direction: "up" | "down",
): EditSpec {
  const idx = spec.clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return spec;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= spec.clips.length) return spec;
  const next = spec.clips.slice();
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  return { ...spec, clips: next };
}

/**
 * Sanity-checks an edit spec. Surfaces the first failure as `reason` so the
 * UI can show something specific.
 */
export function validateSpec(spec: EditSpec): ValidateResult {
  if (!spec.baseVersionId) {
    return { ok: false, reason: "Spec is missing baseVersionId." };
  }
  if (spec.clips.length === 0) {
    return { ok: false, reason: "Spec must contain at least one clip." };
  }
  for (const clip of spec.clips) {
    if (!clip.id) return { ok: false, reason: "Clip is missing an id." };
    if (!clip.sourceVersionId) {
      return {
        ok: false,
        reason: `Clip ${clip.id} is missing sourceVersionId.`,
      };
    }
    if (!Number.isFinite(clip.startMs) || !Number.isFinite(clip.endMs)) {
      return {
        ok: false,
        reason: `Clip ${clip.id} has non-finite range.`,
      };
    }
    if (clip.startMs < 0) {
      return { ok: false, reason: `Clip ${clip.id} starts before 0.` };
    }
    if (clip.startMs >= clip.endMs) {
      return {
        ok: false,
        reason: `Clip ${clip.id} has empty or inverted range.`,
      };
    }
    if (clip.endMs > clip.sourceDurationMs) {
      return {
        ok: false,
        reason: `Clip ${clip.id} extends past its source duration.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Builds the initial spec for a freshly opened editor: a single clip
 * spanning the focused version end-to-end.
 */
export function initialSpecForVersion(args: {
  versionId: string;
  label: string;
  durationMs: number;
}): EditSpec {
  const clip: EditSpecClip = {
    id: `clip_${args.versionId}_1`,
    sourceVersionId: args.versionId,
    label: args.label,
    sourceDurationMs: args.durationMs,
    startMs: 0,
    endMs: args.durationMs,
  };
  return { baseVersionId: args.versionId, clips: [clip] };
}

/** Format `mm:ss.SSS` for compact, monospaced clip range labels. */
export function formatTimecode(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00.000";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms - totalSeconds * 1000);
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  const pad3 = (n: number) => n.toString().padStart(3, "0");
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}
