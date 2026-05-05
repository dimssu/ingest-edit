import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Source platforms supported for ingestion. Declared as an enum array of one
 * for now; new platforms (TikTok, YouTube, etc.) plug in here.
 */
export const SOURCE_PLATFORMS = ["instagram"] as const;
export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

/**
 * One per ingested video. Mirrors the original asset uploaded to S3 plus all
 * probe-derived metadata. Derived edits live in the `Version` collection.
 */
/**
 * Branded ids (`ItemId`, `UserId`) are typed as plain `string` here for
 * Mongoose generic compatibility. The route layer narrows on read.
 */
export interface ItemDoc {
  itemId: string;
  userId: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  s3Key: string;
  thumbnailKey?: string;
  durationMs: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec?: string;
  videoBitrate?: number;
  audioBitrate?: number;
  framerate?: number;
  fileSizeBytes?: number;
  // reason: ffprobe / yt-dlp dump shape varies wildly across sources;
  // we store the raw object verbatim and parse on demand.
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ItemModel = Model<ItemDoc>;

const itemSchema = new Schema<ItemDoc, ItemModel>(
  {
    itemId: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    sourcePlatform: {
      type: String,
      required: true,
      enum: SOURCE_PLATFORMS,
    },
    s3Key: { type: String, required: true },
    thumbnailKey: { type: String },
    durationMs: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
    videoCodec: { type: String, required: true },
    audioCodec: { type: String },
    videoBitrate: { type: Number, min: 0 },
    audioBitrate: { type: Number, min: 0 },
    framerate: { type: Number, min: 0 },
    fileSizeBytes: { type: Number, min: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: "items" },
);

// Indexes — `itemId` unique index is declared on the field above.
itemSchema.index({ userId: 1, createdAt: -1 });

export type ItemDocument = HydratedDocument<ItemDoc>;

export const Item: ItemModel =
  (mongoose.models.Item as ItemModel | undefined) ??
  mongoose.model<ItemDoc, ItemModel>("Item", itemSchema);
