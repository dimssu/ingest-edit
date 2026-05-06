# ingest-edit

Single-user web app for ingesting Instagram videos, organizing variants on a
canvas workspace, and producing quality-preserving cuts via a timeline editor.

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind** + **shadcn/ui**
- **MongoDB** via **Mongoose**
- **AWS S3** for original and rendered media
- **ffmpeg** + **yt-dlp** subprocesses (argv-only, never shell strings)
- **In-process job queue** (`p-queue`) with state persisted to MongoDB so jobs
  survive restarts
- **SWR** for client data, **pino** for server logs

The app is structured as a single Next.js process. The job runner lives in the
same Node runtime; you can move workers out to a separate process by importing
`lib/jobs/runner.ts` from a standalone entrypoint when scale demands it.

## Quality preservation

The editor's contract is that originals are never silently re-compressed.
Every ffmpeg pipeline (`trim`, `concat`, `audio-extract`, `audio-swap`)
defaults to **stream-copy only** (`-c copy`). When stream-copy fails because
input codecs are heterogeneous, the operation throws a clear error rather
than auto-falling-back to a re-encode. Each helper exposes an explicit
`fallbackEncode` / `allowReencode` / `allowAudioReencode` opt-in for callers
that have a deliberate user signal to accept lossy re-encoding (CRF 17 video,
AAC 192 kbps audio when forced). Trim accuracy is keyframe-snap (input-side
`-ss`); see `lib/video/trim.ts` for the documented caveat.

---

## List A — Do BEFORE running locally

These are blockers. Without them the app boots but every backed feature
returns a clear "Missing required environment variables" error.

| # | Item | Why | Where |
|---|---|---|---|
| 1 | **AWS account + S3 bucket** | Stores ingested originals, rendered versions, and audio assets | [console.aws.amazon.com/s3](https://console.aws.amazon.com/s3) — create a bucket (e.g. `ingest-edit-media`), pick a region |
| 2 | **AWS IAM user** with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` scoped to that bucket | Programmatic access for the backend | [console.aws.amazon.com/iam](https://console.aws.amazon.com/iam) — generate an access key + secret |
| 3 | **MongoDB** (any deployment — Atlas free tier, local `docker run mongo`, or self-hosted) | Items, versions, audio assets, jobs | Atlas: [cloud.mongodb.com](https://cloud.mongodb.com). Local: `docker run -d --name mongo -p 27017:27017 mongo:7` |
| 4 | **Instagram session cookies** in Netscape format | yt-dlp uses these to download private/restricted reels and to avoid rate limits | Use the [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookies-locally/cclelndahbckbenkjhflpdbgdldlbecc) Chrome extension while logged into instagram.com; export and place at `./secrets/instagram-cookies.txt` (gitignored) |
| 5 | **`ffmpeg`, `ffprobe`, `yt-dlp`, `node ≥ 20`, `pnpm`** on `PATH` | Required toolchain | macOS: `brew install ffmpeg yt-dlp node pnpm`. Linux: package manager + [yt-dlp install](https://github.com/yt-dlp/yt-dlp/wiki/Installation) |

## Setup

```bash
git clone git@github.com:dimssu/ingest-edit.git
cd ingest-edit
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and fill in MONGODB_URI, AWS_*, S3_BUCKET, etc.

# Drop your Instagram cookies (gitignored)
# (path is configurable via INSTAGRAM_COOKIES_PATH; default is below)
mv ~/Downloads/instagram-cookies.txt secrets/instagram-cookies.txt

# Boot
pnpm dev          # http://localhost:3000
```

### Without backend credentials

You can preview the populated dashboard, canvas, and editor before wiring up
real services by setting `NEXT_PUBLIC_USE_FAKE_DATA=1` in `.env`. This loads
deterministic mock data through the same client surfaces that real APIs
would. The flag is forced off in production builds regardless of value, and
the mock module is dynamically imported so it never enters the production
browser bundle.

## Scripts

```bash
pnpm dev          # Next dev server (Turbopack)
pnpm build        # production build
pnpm start        # serve the production build
pnpm lint         # eslint
pnpm tsc --noEmit # typecheck only
```

## Repository layout

```
app/
  api/                       # route handlers (App Router)
    ingest/                  # POST: kick off Instagram download job
    items/                   # list + per-item detail
    jobs/[jobId]/            # poll job state
    render/                  # POST: submit an edit spec
    audio/{extract,swap}/    # POST: audio operations
  dashboard/                 # main grid + ingest input
  items/[itemId]/            # canvas (per-item workspace)
  items/[itemId]/edit/[versionId]/   # timeline editor

components/                  # shared shadcn primitives
lib/
  client/                    # browser-side: SWR helpers, formatters, mock layer
  db/                        # Mongoose connection + models
  ingest/                    # yt-dlp wrapper, Instagram URL guard
  jobs/                      # in-process queue, runner, executors, registry
  server/                    # env validation, logger, bootstrap, errors
  storage/                   # S3 client + key builders
  video/                     # ffmpeg/ffprobe wrappers (trim, concat, audio ops)

types/                       # shared TS types + zod schemas
secrets/                     # gitignored runtime secrets (cookies file)
```

## How a job moves through the system

1. The client calls a `POST /api/ingest|render|audio/extract|audio/swap` route.
2. The route validates the request body (zod), checks ownership (item, version,
   audio asset all belong to the same user), then `enqueueJob(...)` creates a
   `Job` document in MongoDB with `state: queued`.
3. The in-process queue (`lib/jobs/queue.ts`) pulls the job. The runner
   (`lib/jobs/runner.ts`) atomically claims it via `findOneAndUpdate` so two
   workers can't both run the same job.
4. The kind-specific executor (`lib/jobs/executors/{ingest,render,audio-*}.ts`)
   downloads the source media from S3 to a per-job temp dir, runs the ffmpeg
   pipeline (always stream-copy by default), uploads the result back to S3,
   and creates the corresponding `Item` / `Version` / `AudioAsset` document.
5. The runner persists progress (throttled to ~1 Hz) and the terminal
   `succeeded` / `failed` state. The client polls `/api/jobs/[jobId]`.

If the worker process crashes, `Job.markOrphanedAsFailed()` (called from
`bootServer`) flips any `running` jobs back to `failed` so the UI doesn't
render them as in-flight forever.

## Production hardening

- **Error responses**: in `production` (`NODE_ENV=production`), unhandled
  non-`AppError` errors return a generic message with a `requestId` for
  log correlation; raw error messages and stacks are never sent to clients.
  In development, raw messages echo through so debugging is fast. See
  `lib/server/http.ts`.
- **ffmpeg timeouts**: every spawn enforces a default 5-minute timeout
  (30 seconds for probe + thumbnail). On expiry the process gets `SIGTERM`,
  then `SIGKILL` after a 2 s grace.
- **Quality policy**: see the "Quality preservation" section above.
- **SSRF guard**: `validateInstagramUrl` (`lib/ingest/instagram.ts`) rejects
  non-https schemes, foreign hosts (including `instagram.com.evil.tld`-style
  confusion), and unknown path prefixes before any URL touches yt-dlp.

---

## List B — Do AFTER you've built it (production deployment)

These are the manual steps required to take the app live. Each item is
out-of-scope for this codebase but required for a healthy deployment.

| # | Item | Why | Where |
|---|---|---|---|
| 1 | **Pick a deploy target with persistent disk + ffmpeg/yt-dlp** | Vercel won't work — the worker needs subprocess access and a writable temp dir. Choose Fly.io, Railway, Render, an EC2/Hetzner VM, or self-hosted Docker | Recommended: a single small VM (1–2 vCPU, 2 GB RAM, 20 GB disk for temp dirs) with Node 20, ffmpeg, yt-dlp installed |
| 2 | **Set `NODE_ENV=production`** in the deploy environment | Triggers error-message sanitization, JSON logging, and the production Next build | Your platform's env-var dashboard |
| 3 | **Provision real `MONGODB_URI`, `MONGODB_DB_NAME`, `AWS_*`, `S3_BUCKET`, `APP_USER_ID`, `INSTAGRAM_COOKIES_PATH`** | The app validates them lazily and fails loud on first use | Same env-var dashboard |
| 4 | **Drop the Instagram cookies file** at the path `INSTAGRAM_COOKIES_PATH` points to (default `./secrets/instagram-cookies.txt`) | yt-dlp loads it on every download | Use a deploy-time secret-mount (Fly secrets, Railway shared volumes, AWS SSM) — never bake it into the image |
| 5 | **Set up MongoDB indexes** | The app declares them via Mongoose; in production with a fresh DB, run `await db.collection.syncIndexes()` once or rely on automatic creation on first write | Connect via `mongosh` and verify indexes on `items`, `versions`, `audio_assets`, `jobs`, `users` |
| 6 | **Configure S3 lifecycle rules** | Per-job temp dirs are cleaned up on the host; S3 keeps every original/version/asset forever unless you set a lifecycle policy. Decide retention (e.g. 90-day cold storage for `originals/*`) | S3 console → bucket → Management → Lifecycle |
| 7 | **Configure CloudFront (or other CDN)** in front of the S3 bucket | Optional but recommended for video playback latency. If used, set `S3_PUBLIC_BASE_URL` so the API serves CDN URLs instead of presigned ones | CloudFront console; restrict origin to the bucket via OAC |
| 8 | **DNS + TLS** | Point a domain at the deploy target; ensure HTTPS terminates correctly (most platforms handle this for you) | Your registrar + platform |
| 9 | **Update `APP_URL`** in production env to the canonical https URL | Reserved for future OAuth/auth flows and absolute-URL email/share links — declared in `lib/server/env.ts` and not consumed yet, but worth setting now so it's correct when needed | Env-var dashboard |
| 10 | **Set up log shipping / monitoring** | Pino emits JSON to stdout. Pipe to your log aggregator (Datadog, Better Stack, CloudWatch, Loki); set alerts on `level: error` lines, especially `Unhandled route error` | Platform-specific |
| 11 | **MongoDB backups** | Atlas: enable continuous backups. Self-hosted: schedule `mongodump` to S3 daily | Atlas dashboard or a cron job |
| 12 | **Rotate the IAM access key** at least every 90 days | Standard hygiene | IAM console → users → security credentials |
| 13 | **Refresh Instagram cookies** when downloads start failing with auth errors | Cookies expire / get invalidated periodically | Re-export from a logged-in browser session |
| 14 | **Decide concurrency** via `JOB_CONCURRENCY` env (default 2) | ffmpeg is CPU-bound; on a 2-vCPU host, 2 is sane. Bump up only if downloads dominate. | Env-var dashboard |
| 15 | **Set the user via `APP_USER_ID`** | Single-tenant identity is hardcoded in `.env`; everything in the app is scoped to it | Env-var dashboard |
| 16 | **Audit dependencies before each release** | `pnpm audit`, watch for security advisories on `next`, `mongoose`, `aws-sdk`, `yt-dlp` | CI step |

### Optional — niceties for later

- **Multi-user**: schema already includes `userId` on every doc. Adding auth
  (NextAuth, custom JWT, magic links) and stripping the `APP_USER_ID` boot
  requirement is a one-week task.
- **Real-time progress over SSE**: replace the SWR poll on `/api/jobs/[id]`
  with Server-Sent Events for sub-second updates.
- **Drag-and-drop clip reorder** in the editor (currently up/down arrows).
- **Audio waveform** overlay on the timeline.
- **Audio upload**: the swap dialog only picks from existing assets today.
- **Frame-accurate trim** behind a `precise: true` flag (would re-encode the
  leading partial GOP).

## License

Private. All rights reserved.
