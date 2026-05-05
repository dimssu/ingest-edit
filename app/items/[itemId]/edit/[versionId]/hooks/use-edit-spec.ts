"use client";

import { useEditSpecContext } from "@/app/items/[itemId]/edit/[versionId]/components/edit-spec-context";

/**
 * Thin re-export of the context hook so consumers can import from a hooks/
 * path rather than reaching into components/. Keeps the module graph tidy.
 */
export function useEditSpec() {
  return useEditSpecContext();
}
