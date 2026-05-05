/**
 * Shared, app-wide types. Specific feature types belong next to their
 * implementation; only put cross-cutting types here.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type ItemId = Brand<string, "ItemId">;
export type VersionId = Brand<string, "VersionId">;
export type JobId = Brand<string, "JobId">;
