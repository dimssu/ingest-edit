"use client";

import { useCallback, useRef, useState } from "react";

interface UsePlayerResult {
  /** Callback ref — attach to the <video> element. Reattaches when the
   * element is conditionally rendered (e.g. videoUrl flips from undefined
   * to defined as data loads). */
  videoRef: (node: HTMLVideoElement | null) => void;
  /** Read-only access to the current element (for imperative reads). */
  videoEl: () => HTMLVideoElement | null;
  playing: boolean;
  /** Current playback position in the underlying video, in ms. */
  currentMs: number;
  /** Source duration as reported by the <video> element (ms). */
  durationMs: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (ms: number) => void;
}

/**
 * Wraps a `<video>` element with a small reactive surface: tracks the
 * current time and play/pause state and exposes imperative controls.
 *
 * Deliberately scoped to a single source — multi-source seamless playback
 * across clips is a Phase 8 concern (see editor README in the brief).
 */
export function usePlayer(): UsePlayerResult {
  const elRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // Callback ref: re-runs whenever the <video> mounts or unmounts (which
  // happens when the player swaps a placeholder for a real <video> after
  // the URL becomes available). useEffect with a stable ref would miss
  // this transition because refs don't trigger effects.
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    elRef.current = node;
    if (!node) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentMs(Math.round(node.currentTime * 1000));
    const onLoaded = () => {
      setDurationMs(
        Number.isFinite(node.duration) ? Math.round(node.duration * 1000) : 0,
      );
      setCurrentMs(Math.round(node.currentTime * 1000));
    };
    const onEnded = () => setPlaying(false);

    node.addEventListener("play", onPlay);
    node.addEventListener("pause", onPause);
    node.addEventListener("timeupdate", onTime);
    node.addEventListener("loadedmetadata", onLoaded);
    node.addEventListener("ended", onEnded);

    cleanupRef.current = () => {
      node.removeEventListener("play", onPlay);
      node.removeEventListener("pause", onPause);
      node.removeEventListener("timeupdate", onTime);
      node.removeEventListener("loadedmetadata", onLoaded);
      node.removeEventListener("ended", onEnded);
    };
  }, []);

  const videoEl = useCallback(() => elRef.current, []);

  const play = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    void el.play().catch(() => {
      // Autoplay or load failures — fall through silently; the UI still
      // reflects state via the `pause` event.
    });
  }, []);

  const pause = useCallback(() => {
    elRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const seekTo = useCallback((ms: number) => {
    const el = elRef.current;
    if (!el) return;
    const clamped = Math.max(
      0,
      Number.isFinite(el.duration) ? Math.min(ms / 1000, el.duration) : ms / 1000,
    );
    el.currentTime = clamped;
    setCurrentMs(Math.round(clamped * 1000));
  }, []);

  return {
    videoRef,
    videoEl,
    playing,
    currentMs,
    durationMs,
    play,
    pause,
    toggle,
    seekTo,
  };
}
