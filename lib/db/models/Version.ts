import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Operations that produce a derived Version. `original` is the root version
 * created alongside the Item itself.
 */
export const DERIVED_OPS = [
  "original",
  "split",
  "trim",
  "concat",
  "append",
  "audio-swap",
  "audio-extract",
] as const;
export type DerivedOp = (typeof DERIVED_OPS)[number];

export interface DerivedFrom {
  op: DerivedOp;
  // reason: params shape depends on `op` (trim has start/end, concat has
  // version ids, etc.) and is narrowed by the runner — schema-level we
  // accept any structured payload.
  params: Record<string, unknown>;
}

/**
 * A derived (or root) variant of an Item. The root version's
 * `parentVersionId` is null and represents the unmodified original.
 *
 * Branded ids (`ItemId`, `UserId`, `VersionId`) are typed as plain `string`
 * here for Mongoose generic compatibility.
 */
export interface VersionDoc {
  versionId: string;
  userId: string;
  itemId: string;
  parentVersionId: string | null;
  label: string;
  s3Key: string;
  durationMs: number;
  derivedFrom: DerivedFrom;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  fileSizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VersionModel = Model<VersionDoc>;

const derivedFromSchema = new Schema<DerivedFrom>(
  {
    op: { type: String, required: true, enum: DERIVED_OPS },
    params: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { _id: false },
);

const versionSchema = new Schema<VersionDoc, VersionModel>(
  {
    versionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    userId: { type: String, required: true },
    itemId: { type: String, required: true },
    parentVersionId: { type: String, default: null },
    label: { type: String, required: true },
    s3Key: { type: String, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    derivedFrom: { type: derivedFromSchema, required: true },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    videoCodec: { type: String },
    audioCodec: { type: String },
    fileSizeBytes: { type: Number, min: 0 },
  },
  { timestamps: true, collection: "versions" },
);

// Indexes — `versionId` unique index is declared on the field above.
versionSchema.index({ itemId: 1, createdAt: -1 });
versionSchema.index({ parentVersionId: 1 });

export type VersionDocument = HydratedDocument<VersionDoc>;

export const Version: VersionModel =
  (mongoose.models.Version as VersionModel | undefined) ??
  mongoose.model<VersionDoc, VersionModel>("Version", versionSchema);
