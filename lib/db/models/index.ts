/**
 * Barrel for Mongoose models. Importing this file ensures every model is
 * registered on the default mongoose instance once.
 */
export {
  User,
  type UserDoc,
  type UserDocument,
  type UserModel,
} from "@/lib/db/models/User";

export {
  Item,
  SOURCE_PLATFORMS,
  type ItemDoc,
  type ItemDocument,
  type ItemModel,
  type SourcePlatform,
} from "@/lib/db/models/Item";

export {
  Version,
  DERIVED_OPS,
  type DerivedFrom,
  type DerivedOp,
  type VersionDoc,
  type VersionDocument,
  type VersionModel,
} from "@/lib/db/models/Version";

export {
  AudioAsset,
  AUDIO_FORMATS,
  type AudioAssetDoc,
  type AudioAssetDocument,
  type AudioAssetModel,
  type AudioFormat,
} from "@/lib/db/models/AudioAsset";

export {
  Job,
  JOB_KINDS,
  JOB_STATES,
  type JobDoc,
  type JobDocument,
  type JobErrorInfo,
  type JobModel,
} from "@/lib/db/models/Job";
