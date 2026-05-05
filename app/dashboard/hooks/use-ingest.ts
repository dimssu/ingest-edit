"use client";

import { useCallback, useState } from "react";
import { ApiError, postIngest } from "@/lib/client/api";
import type { IngestResponse } from "@/types/api";

interface UseIngestState {
  isSubmitting: boolean;
  error: ApiError | null;
}

export function useIngest() {
  const [state, setState] = useState<UseIngestState>({
    isSubmitting: false,
    error: null,
  });

  const submit = useCallback(
    async (sourceUrl: string): Promise<IngestResponse | null> => {
      setState({ isSubmitting: true, error: null });
      try {
        const res = await postIngest({ sourceUrl });
        setState({ isSubmitting: false, error: null });
        return res;
      } catch (err) {
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError(
                "INTERNAL_ERROR",
                err instanceof Error ? err.message : "Request failed",
                500,
              );
        setState({ isSubmitting: false, error: apiErr });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ isSubmitting: false, error: null });
  }, []);

  return { ...state, submit, reset };
}
