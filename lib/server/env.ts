import { z } from "zod";

/**
 * Environment schema. Validation runs eagerly on first import: only the
 * small boot-required surface (`APP_USER_ID`, `NODE_ENV`, `LOG_LEVEL`) is
 * mandatory; every other key is optional here and gated at call time by
 * `requireEnv(...)` so unused features don't block boot.
 */
const envSchema = z.object({
  // App (boot-required)
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_USER_ID: z.string().min(1, "APP_USER_ID is required"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Database (optional at boot)
  MONGODB_URI: z.string().url().optional(),
  MONGODB_DB_NAME: z.string().min(1).optional(),

  // AWS S3 (optional at boot)
  AWS_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),

  // Instagram ingestion (optional at boot)
  INSTAGRAM_COOKIES_PATH: z.string().min(1).optional(),

  // Job queue
  JOB_CONCURRENCY: z
    .string()
    .regex(/^\d+$/u, "JOB_CONCURRENCY must be a positive integer")
    .transform((v) => Number.parseInt(v, 10))
    .default(2),

  // Binary overrides (optional)
  FFMPEG_PATH: z.string().min(1).optional(),
  FFPROBE_PATH: z.string().min(1).optional(),
  YT_DLP_PATH: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // Re-throw a clearer error so missing-but-required boot vars fail loud.
  throw new Error(
    `Invalid environment configuration:\n${issues}\n` +
      `Check your .env against .env.example.`,
  );
}

export const env: Env = parsed.data;

/**
 * Asserts that the listed env keys are populated. Subsystems (S3, Mongo, etc.)
 * call this lazily so that boot does not fail when a feature is unused.
 *
 * Throws an Error listing every missing key.
 */
export function requireEnv<K extends keyof Env>(...keys: K[]): void {
  const missing: string[] = [];
  for (const key of keys) {
    const value = env[key];
    if (value === undefined || value === null || value === "") {
      missing.push(String(key));
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in .env (see .env.example).`,
    );
  }
}
