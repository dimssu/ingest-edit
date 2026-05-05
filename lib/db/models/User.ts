import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Single-tenant user record. Identity comes from the `APP_USER_ID` env var;
 * `ensureSingleUser` is invoked on first DB connect to upsert this row.
 *
 * Note: `userId` is typed as plain `string` here for Mongoose schema
 * compatibility. Consumers that need the branded `UserId` should narrow at
 * the call site (e.g. via the `as UserId` cast in route handlers).
 */
export interface UserDoc {
  userId: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserModel extends Model<UserDoc> {
  ensureSingleUser(userId: string): Promise<void>;
}

const userSchema = new Schema<UserDoc, UserModel>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    displayName: { type: String },
  },
  { timestamps: true, collection: "users" },
);

// Indexes are declared via `unique: true` on the `userId` field above,
// which Mongoose materializes as a unique index on first model build.

userSchema.statics.ensureSingleUser = async function (
  this: UserModel,
  userId: string,
): Promise<void> {
  await this.updateOne(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true },
  );
};

export type UserDocument = HydratedDocument<UserDoc>;

export const User: UserModel =
  (mongoose.models.User as UserModel | undefined) ??
  mongoose.model<UserDoc, UserModel>("User", userSchema);
