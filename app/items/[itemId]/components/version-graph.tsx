"use client";

import { useMemo, useRef, useEffect } from "react";

import { cn } from "@/lib/utils";
import type { VersionSummary } from "@/types/api";

import { VersionNode } from "./version-node";

interface VersionGraphProps {
  versions: VersionSummary[];
  focusedVersionId: string | null;
  onFocus: (versionId: string) => void;
}

interface TreeNode {
  version: VersionSummary;
  depth: number;
  children: TreeNode[];
}

/**
 * Builds a tree from a flat version list using parentVersionId. We don't
 * trust that the API returns versions in topological order, so we resolve
 * the graph in-memory; orphaned subtrees (parent not present) are
 * promoted to roots so nothing silently disappears.
 */
function buildTree(versions: VersionSummary[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const v of versions) {
    byId.set(v.versionId, { version: v, depth: 0, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const v of versions) {
    const node = byId.get(v.versionId);
    if (!node) continue;
    const parent =
      v.parentVersionId !== null ? byId.get(v.parentVersionId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Stamp depth via DFS so children render with consistent indentation.
  const setDepth = (node: TreeNode, depth: number) => {
    node.depth = depth;
    // Stable sort — older first within siblings.
    node.children.sort(
      (a, b) =>
        new Date(a.version.createdAt).getTime() -
        new Date(b.version.createdAt).getTime(),
    );
    for (const child of node.children) setDepth(child, depth + 1);
  };
  roots.sort(
    (a, b) =>
      new Date(a.version.createdAt).getTime() -
      new Date(b.version.createdAt).getTime(),
  );
  for (const r of roots) setDepth(r, 0);

  return roots;
}

function flatten(roots: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    out.push(node);
    for (const c of node.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}

export function VersionGraph({
  versions,
  focusedVersionId,
  onFocus,
}: VersionGraphProps) {
  const tree = useMemo(() => buildTree(versions), [versions]);
  const dfs = useMemo(() => flatten(tree), [tree]);

  // Refs by versionId for keyboard navigation between nodes.
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Live region for announcing focus changes — kept cheap and short.
  const liveRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!liveRef.current || !focusedVersionId) return;
    const node = dfs.find((n) => n.version.versionId === focusedVersionId);
    if (!node) return;
    liveRef.current.textContent = `Focused ${node.version.label}, ${node.version.derivedFrom.op}.`;
  }, [focusedVersionId, dfs]);

  const setRef = (id: string) => (el: HTMLButtonElement | null) => {
    if (el) buttonRefs.current.set(id, el);
    else buttonRefs.current.delete(id);
  };

  const handleKeyNav = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const active = document.activeElement;
    const currentId = dfs.find(
      (n) => buttonRefs.current.get(n.version.versionId) === active,
    )?.version.versionId;
    if (!currentId) return;
    const idx = dfs.findIndex((n) => n.version.versionId === currentId);
    const nextIdx =
      event.key === "ArrowDown"
        ? Math.min(dfs.length - 1, idx + 1)
        : Math.max(0, idx - 1);
    const next = dfs[nextIdx];
    if (!next) return;
    event.preventDefault();
    const el = buttonRefs.current.get(next.version.versionId);
    el?.focus();
  };

  return (
    <section
      aria-label="Versions"
      className="space-y-4"
      onKeyDown={handleKeyNav}
    >
      <header className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Versions
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({versions.length})
        </span>
      </header>

      {tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
          No versions yet.
        </div>
      ) : (
        <ol className="space-y-2.5">
          {dfs.map((node) => (
            <li key={node.version.versionId}>
              <div
                className={cn(
                  "relative",
                  node.depth > 0 && "border-l border-border/60",
                )}
                style={{
                  marginInlineStart:
                    node.depth > 0 ? `${node.depth * 20}px` : undefined,
                  paddingInlineStart: node.depth > 0 ? "16px" : undefined,
                }}
              >
                {node.depth > 0 ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-6 h-px w-3.5 bg-border/60"
                  />
                ) : null}
                <VersionNode
                  ref={setRef(node.version.versionId)}
                  version={node.version}
                  focused={focusedVersionId === node.version.versionId}
                  onFocus={onFocus}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div ref={liveRef} aria-live="polite" className="sr-only" />
    </section>
  );
}
