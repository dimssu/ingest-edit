"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeValidationFailure,
  validateInstagramUrl,
} from "@/lib/client/validate";
import { useIngest } from "@/app/dashboard/hooks/use-ingest";
import { ITEMS_KEY } from "@/app/dashboard/hooks/use-items";
import { useJobsContext } from "@/app/dashboard/components/jobs-context";

export function IngestForm() {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const { isSubmitting, error: serverError, submit, reset } = useIngest();
  const { trackJob } = useJobsContext();
  const { mutate } = useSWRConfig();

  const trimmed = value.trim();
  const localValidation = useMemo(() => {
    if (trimmed.length === 0) return null;
    return validateInstagramUrl(trimmed);
  }, [trimmed]);

  const localError =
    touched && localValidation && !localValidation.ok
      ? describeValidationFailure(localValidation.reason)
      : null;

  const submitDisabled =
    isSubmitting ||
    trimmed.length === 0 ||
    (localValidation !== null && !localValidation.ok);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitDisabled) return;
    if (!localValidation || !localValidation.ok) return;

    const sourceUrl = localValidation.url;
    const result = await submit(sourceUrl);
    if (result) {
      trackJob({ jobId: result.jobId, sourceUrl });
      setValue("");
      setTouched(false);
      reset();
      toast.success("Ingest started");
      // Nudge the items list so the new item appears as soon as it lands.
      void mutate(ITEMS_KEY);
    }
  }

  const displayedError = localError ?? serverError?.message ?? null;
  const describedBy = displayedError ? `${hintId} ${errorId}` : hintId;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <Label htmlFor={inputId} className="sr-only">
        Instagram URL
      </Label>
      <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-start">
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.instagram.com/reel/…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (serverError) reset();
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={localError !== null}
          aria-describedby={describedBy}
          disabled={isSubmitting}
          className="h-10 flex-1 text-base sm:text-sm"
        />
        <Button
          type="submit"
          size="lg"
          disabled={submitDisabled}
          className="h-10 px-5 sm:w-auto"
        >
          {isSubmitting ? "Starting…" : "Ingest"}
        </Button>
      </div>
      <div className="flex flex-col gap-1 max-w-2xl">
        <p id={hintId} className="text-xs text-muted-foreground">
          Paste an Instagram reel, post, or IGTV link.
        </p>
        {displayedError ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-destructive"
          >
            {displayedError}
          </p>
        ) : null}
      </div>
    </form>
  );
}
