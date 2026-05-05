"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  appendClip as appendClipPure,
  initialSpecForVersion,
  moveClip as moveClipPure,
  removeClip as removeClipPure,
  removeRangeMs as removeRangePure,
  splitClipAtGlobalMs as splitClipPure,
  type EditSpec,
  type EditSpecClip,
} from "@/lib/client/edit-spec";

interface InitArgs {
  versionId: string;
  label: string;
  durationMs: number;
}

interface State {
  spec: EditSpec;
  /** Inclusive start of the in/out range, in global ms. null = not set. */
  inMs: number | null;
  /** Exclusive end of the in/out range. null = not set. */
  outMs: number | null;
  /** id of the clip being previewed in the player. null = first clip. */
  previewClipId: string | null;
  /** Global playhead position in ms — owned here so tools and timeline agree. */
  playheadMs: number;
}

type Action =
  | { type: "split"; globalMs: number }
  | { type: "removeRange"; startMs: number; endMs: number }
  | { type: "appendClip"; clip: EditSpecClip }
  | { type: "removeClip"; clipId: string }
  | { type: "moveClip"; clipId: string; direction: "up" | "down" }
  | { type: "setInPoint"; ms: number | null }
  | { type: "setOutPoint"; ms: number | null }
  | { type: "clearMarks" }
  | { type: "setPreviewClip"; clipId: string }
  | { type: "setPlayhead"; ms: number };

function clampMarks(state: State): State {
  // Drop marks/playhead values that fall outside the current spec.
  let totalMs = 0;
  for (const c of state.spec.clips) totalMs += Math.max(0, c.endMs - c.startMs);
  let inMs = state.inMs;
  let outMs = state.outMs;
  let playheadMs = state.playheadMs;
  if (inMs !== null && (inMs < 0 || inMs > totalMs)) inMs = null;
  if (outMs !== null && (outMs < 0 || outMs > totalMs)) outMs = null;
  if (inMs !== null && outMs !== null && outMs <= inMs) {
    // Inverted after a structural change → clear both rather than guess.
    inMs = null;
    outMs = null;
  }
  if (playheadMs > totalMs) playheadMs = totalMs;
  if (playheadMs < 0) playheadMs = 0;
  if (
    inMs === state.inMs &&
    outMs === state.outMs &&
    playheadMs === state.playheadMs
  ) {
    return state;
  }
  return { ...state, inMs, outMs, playheadMs };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "split": {
      const next = splitClipPure(state.spec, action.globalMs);
      return clampMarks({ ...state, spec: next });
    }
    case "removeRange": {
      const next = removeRangePure(state.spec, action.startMs, action.endMs);
      return clampMarks({
        ...state,
        spec: next,
        inMs: null,
        outMs: null,
      });
    }
    case "appendClip": {
      const next = appendClipPure(state.spec, action.clip);
      return { ...state, spec: next };
    }
    case "removeClip": {
      const next = removeClipPure(state.spec, action.clipId);
      const previewClipId =
        state.previewClipId === action.clipId
          ? (next.clips[0]?.id ?? null)
          : state.previewClipId;
      return clampMarks({ ...state, spec: next, previewClipId });
    }
    case "moveClip": {
      const next = moveClipPure(state.spec, action.clipId, action.direction);
      return { ...state, spec: next };
    }
    case "setInPoint": {
      let outMs = state.outMs;
      if (action.ms !== null && outMs !== null && outMs <= action.ms) {
        outMs = null;
      }
      return { ...state, inMs: action.ms, outMs };
    }
    case "setOutPoint": {
      let inMs = state.inMs;
      if (action.ms !== null && inMs !== null && inMs >= action.ms) {
        inMs = null;
      }
      return { ...state, outMs: action.ms, inMs };
    }
    case "clearMarks": {
      return { ...state, inMs: null, outMs: null };
    }
    case "setPreviewClip": {
      return { ...state, previewClipId: action.clipId };
    }
    case "setPlayhead": {
      return { ...state, playheadMs: Math.max(0, action.ms) };
    }
    default:
      return state;
  }
}

interface ContextValue {
  state: State;
  dispatch: Dispatch<Action>;
  // Convenience-bound action creators so consumers don't repeat type literals.
  split: (globalMs: number) => void;
  removeRange: (startMs: number, endMs: number) => void;
  appendClip: (clip: EditSpecClip) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, direction: "up" | "down") => void;
  setInPoint: (ms: number | null) => void;
  setOutPoint: (ms: number | null) => void;
  clearMarks: () => void;
  setPreviewClip: (clipId: string) => void;
  setPlayhead: (ms: number) => void;
}

const EditSpecContext = createContext<ContextValue | null>(null);

interface ProviderProps {
  init: InitArgs;
  children: ReactNode;
}

export function EditSpecProvider({ init, children }: ProviderProps) {
  const initialSpec = useMemo(
    () =>
      initialSpecForVersion({
        versionId: init.versionId,
        label: init.label,
        durationMs: init.durationMs,
      }),
    [init.versionId, init.label, init.durationMs],
  );
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    spec: initialSpec,
    inMs: null,
    outMs: null,
    previewClipId: initialSpec.clips[0]?.id ?? null,
    playheadMs: 0,
  }));

  const split = useCallback(
    (globalMs: number) => dispatch({ type: "split", globalMs }),
    [],
  );
  const removeRange = useCallback(
    (startMs: number, endMs: number) =>
      dispatch({ type: "removeRange", startMs, endMs }),
    [],
  );
  const appendClip = useCallback(
    (clip: EditSpecClip) => dispatch({ type: "appendClip", clip }),
    [],
  );
  const removeClip = useCallback(
    (clipId: string) => dispatch({ type: "removeClip", clipId }),
    [],
  );
  const moveClip = useCallback(
    (clipId: string, direction: "up" | "down") =>
      dispatch({ type: "moveClip", clipId, direction }),
    [],
  );
  const setInPoint = useCallback(
    (ms: number | null) => dispatch({ type: "setInPoint", ms }),
    [],
  );
  const setOutPoint = useCallback(
    (ms: number | null) => dispatch({ type: "setOutPoint", ms }),
    [],
  );
  const clearMarks = useCallback(() => dispatch({ type: "clearMarks" }), []);
  const setPreviewClip = useCallback(
    (clipId: string) => dispatch({ type: "setPreviewClip", clipId }),
    [],
  );
  const setPlayhead = useCallback(
    (ms: number) => dispatch({ type: "setPlayhead", ms }),
    [],
  );

  const value = useMemo<ContextValue>(
    () => ({
      state,
      dispatch,
      split,
      removeRange,
      appendClip,
      removeClip,
      moveClip,
      setInPoint,
      setOutPoint,
      clearMarks,
      setPreviewClip,
      setPlayhead,
    }),
    [
      state,
      split,
      removeRange,
      appendClip,
      removeClip,
      moveClip,
      setInPoint,
      setOutPoint,
      clearMarks,
      setPreviewClip,
      setPlayhead,
    ],
  );

  return (
    <EditSpecContext.Provider value={value}>
      {children}
    </EditSpecContext.Provider>
  );
}

export function useEditSpecContext(): ContextValue {
  const ctx = useContext(EditSpecContext);
  if (!ctx) {
    throw new Error("useEditSpecContext must be used inside EditSpecProvider.");
  }
  return ctx;
}
