import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Audio container/codec formats we accept and surface to the UI.
 */
export const AUDIO_FORMATS = [
  "mp3",
  "aac",
  "wav",
  "m4a",
  "flac",
  "ogg",
] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

/**
 * An audio asset associated with an Item. Either extracted from one of its
 * versions (`sourceVersionId` set) or uploaded by the user.
 *
 * Branded ids (`AudioAssetId`, `ItemId`, `UserId`, `VersionId`) are typed
 * as plain `string` here for Mongoose generic compatibility.
 */
export interface AudioAssetDoc {
  assetId: string;
  userId: string;
  itemId: string;
  sourceVersionId?: string;
  s3Key: string;
  format: AudioFormat;
  durationMs: number;
  sampleRate?: number;
  channels?: number;
  fileSizeBytes?: number;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AudioAssetModel = Model<AudioAssetDoc>;

const audioAssetSchema = new Schema<AudioAssetDoc, AudioAssetModel>(
  {
    assetId: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true },
    itemId: { type: String, required: true },
    sourceVersionId: { type: String },
    s3Key: { type: String, required: true },
    format: { type: String, required: true, enum: AUDIO_FORMATS },
    durationMs: { type: Number, required: true, min: 0 },
    sampleRate: { type: Number, min: 0 },
    channels: { type: Number, min: 0, max: 32 },
    fileSizeBytes: { type: Number, min: 0 },
    label: { type: String },
  },
  { timestamps: true, collection: "audio_assets" },
);

// Indexes — `assetId` unique index is declared on the field above.
audioAssetSchema.index({ itemId: 1, createdAt: -1 });

export type AudioAssetDocument = HydratedDocument<AudioAssetDoc>;

export const AudioAsset: AudioAssetModel =
  (mongoose.models.AudioAsset as AudioAssetModel | undefined) ??
  mongoose.model<AudioAssetDoc, AudioAssetModel>(
    "AudioAsset",
    audioAssetSchema,
  );
