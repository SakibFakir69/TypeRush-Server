# TypeRush — API

REST API for [TypeRush](../typerush-client): accounts and sessions, the practice bank, contest lifecycle, leaderboards, analytics, and avatar uploads.

Express 5 + Prisma + PostgreSQL, deployed on Render. API docs are served by Swagger at `/docs`.

---

## Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Auth model](#auth-model)
- [Roles and guards](#roles-and-guards)
- [Rate limits](#rate-limits)
- [Leaderboards](#leaderboards)
- [Uploads](#uploads)
- [Data model](#data-model)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Stack

| Concern | Technology |
| --- | --- |
| Runtime | Node.js 22 + TypeScript (ESM, `nodenext`) |
| Framework | Express 5 |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Cache / state | Redis (`ioredis`) — OTP codes, cooldowns, cached stats, active-user set, refresh-token revocation |
| Rate limiting | `express-rate-limit` (in-memory store per instance) |
| Auth | JWT access + refresh tokens in httpOnly cookies, bcrypt |
| Google sign-in | `passport-google-oauth20` + authorization-code exchange |
| Email | Brevo (`@getbrevo/brevo`) for OTP and password-reset codes |
| Uploads | Multer → Cloudinary |
| Validation | Zod |
| Docs | `swagger-jsdoc` + `swagger-ui-express` at `/docs` |
| Realtime (planned) | Socket.IO dependency is installed for 1v1 battles |

---

## Architecture

```
Client (Vercel)
   │  https://…/backend/api/v1/*  (proxy keeps cookies first-party)
   ▼
Express app  ── helmet, CORS, JSON, cookies, global rate limit
   │
   ├─ /api/v1/users          users + signup + profile
   ├─ /api/v1/auth           sessions, OTP, Google, password reset
   ├─ /api/v1/practices      passages, results, stats
   ├─ /api/v1/contests       lifecycle, join/leave, submit, boards
   ├─ /api/v1/admin          contests, passages, users
   ├─ /api/v1/announcements  admin CRUD
   ├─ /api/v1/analytics      summary, timeseries, heartbeat
   └─ /api/v1/uploads        image upload → Cloudinary
        │
        ├─▶ PostgreSQL (Prisma) — users, results, passages, contests
        └─▶ Redis — OTP + cooldowns, stats cache, active users, token revocation
```

Layer flow inside every module:

```
route → middleware (verifyToken / verifyRole / rate limit) → controller → service → prisma
```

---

## Project structure

```
src/
  app/
    modules/
      auth/           login, logout, refresh, OTP, Google, reset
      users/          me, signup, update, delete
      practice/       passages, results, stats
      contest/        contests, participation, submissions, boards
      admin/          admin-only contest/passage/user operations
      upload/         Cloudinary upload (+ avatar persistence)
      analytics/      summary, timeseries, heartbeat
      announcements/  admin CRUD
    middleware/       jwt-token, role guards, rate limits, upload, error handling
    index.ts          app assembly (security, routes, 404, error handler)
    server.ts         HTTP listen + Redis connect + Swagger + shutdown
  config/             prisma, redis, cloudinary, email, env
  docs/               swagger config
  helpers/, utils/    response helpers, JWT, OTP, cookies
prisma/               schema + migrations
Dockerfile            multi-stage production image
```

---

## Getting started

### Prerequisites

- Node.js 20+ (developed on Node 22)
- PostgreSQL 14+
- Redis (required — the server throws on boot without `REDIS_URL`)
- A Cloudinary account for uploads
- A Brevo API key for OTP email

### Install and run

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # or `migrate dev` while developing
npm run dev
```

The server listens on `PORT` (required — startup throws without it) and logs the Swagger UI location.

### Docker

```bash
docker build -t typerush-api .
docker run --env-file .env -p 3000:3000 typerush-api
```

The image runs `prisma migrate deploy` before starting `dist/app/server.js`.

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development` / `production`. |
| `PORT` | Yes | HTTP port. Startup fails without it. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET_FOR_ACCESS_TOKEN` | Yes | Signs 15-minute access tokens. |
| `JWT_SECRET_FOR_REFRESH_TOKEN` | Yes | Signs 15-day refresh tokens. |
| `FRONTEND_URL` | Yes | Allowed origin and redirect base for Google/OAuth flows. |
| `REDIS_URL` | Yes | Redis connection string for OTP state, cooldowns, caches, and token revocation. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google sign-in | OAuth credentials. |
| `BREVO_API_KEY` / `MAIL_FROM` | Email | OTP and reset-code delivery. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Uploads | Cloudinary credentials. The key needs the **upload/create** action. |
| `RESEND_EMAIL_API_KEY` | No | Alternative mail provider configuration; unused by the current OTP flow. |

Never commit `.env`. On Render, set these in the service's environment group.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Nodemon + tsx watch on `src/app/server.ts`. |
| `npm run lint` | ESLint over the repository. |
| `npm run lint:fix` | ESLint with autofix. |
| `npx tsc -p tsconfig.json` | Compile to `dist/` (this is the production build). |
| `npm start` | Run the compiled server (`dist/app/server.js`). |

---

## API reference

Base path: `/api/v1`. Interactive docs: `/docs`.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | Rate limited (15 per 15 min). Sets both cookies. |
| `POST` | `/auth/logout` | Clears cookies. |
| `POST` | `/auth/refresh` | Exchanges the refresh cookie for a new access token. |
| `POST` | `/auth/google/exchange` | Exchanges a Google authorization code for a session. |
| `POST` | `/auth/verify` | Verifies the signup OTP. |
| `POST` | `/auth/verify-email` | Verifies an email-change code. |
| `POST` | `/auth/resend-verify-otp` | Sends a fresh signup code. |
| `POST` | `/auth/forgot-password` | Sends a reset code. |
| `POST` | `/auth/reset-password` | Sets a new password with a reset token. |

### Users

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/users` | Current user (`verifyToken`). |
| `POST` | `/users` | Signup (rate limited). |
| `PUT` | `/users` | Update profile, including `avatarUrl`. |
| `DELETE` | `/users` | Delete the account. |

### Practices

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/practices/topics` | Passage bank (used by the practice hub). |
| `GET` | `/practices/:id` | Single passage. |
| `GET` | `/practices/results` | Leaderboard; filter by `duration`, paginate with `offset`. |
| `POST` | `/practices/results` | Submit a run (`wpm`, `accuracy`, `errors`, `timeTaken`, `duration`). |
| `GET` | `/practices/stats/me` | Dashboard stats, 90-day history, recent runs, contest counts. |

### Contests

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/contests` | Upcoming / running list. |
| `GET` | `/contests/all` | Every contest. |
| `GET` | `/contests/my` | Contests the caller joined. |
| `GET` | `/contests/leaderboards` | All per-contest boards. |
| `GET` | `/contests/:id` | Contest detail. |
| `GET` | `/contests/:id/leaderboard` | One contest's board. |
| `POST` | `/contests` | Create (`ADMIN`/`ORG`). `time` is in **seconds**. |
| `POST` | `/contests/:id/join` | Join (`USER`). |
| `DELETE` | `/contests/:id/leave` | Leave. |
| `POST` | `/contests/:id/submit` | Submit a contest run (rate limited). |
| `DELETE` | `/contests/:id` | Delete. |

### Battles (1v1 matchmaking)

All battle routes need a session. `matchmaking` keeps the queue in Redis (sorted set by rating plus an enqueue-time hash), and a worker sweeps it every 1.5 s.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/matchmaking/join` | Join the global queue at your current rating. |
| `POST` | `/matchmaking/cancel` | Leave the queue. |
| `GET` | `/matchmaking/status` | `{ status: "idle" \| "waiting" \| "matched", matchId? }`; also reports an unfinished match. |
| `GET` | `/matchmaking/history` | `?limit=` (max 100): the player's ranked rows, newest first — own WPM/accuracy/errors/result/rating delta, match status and duration, paragraph, and both participants. |
| `GET` | `/matches/:id` | Match view for a participant. Reading an active match counts as being ready to race. |
| `POST` | `/matches/:id/result` | Body `{ wpm, accuracy, errors }`. Settles Elo once both players submit. |
| `POST` | `/matches/:id/forfeit` | Void an unfinished match with no rating change. |
| `GET` | `/ably/token` | Ably token for the lobby: own matchmaking channel, lobby presence, and every active match you are in. |
| `GET` | `/ably/token/:matchId` | Ably token for one active match you participate in. |

Private invites live under the same module at `/api/v1/battle`:

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/battle/invite` | Create an invite `{ time, paragraphId }` → `{ code, expiresIn }`; code lasts 5 min. |
| `POST` | `/battle/invite/accept` | Accept `{ code }`: creates the match immediately and returns `{ matchId, paragraphId }`. |
| `POST` | `/battle/invite/decline` | Decline `{ code }` as the invitee. |
| `POST` | `/battle/invite/cancel` | Revoke your own pending invite. |
| `GET` | `/battle/invite/:code/status` | Polling fallback: status, `matchId`, `paragraphId`. |
| `GET` | `/battle/invite/history` | `?limit=` (max 100): invites sent and received, newest first, with status, code, duration, opponent and paragraph. |
| `GET` | `/ably/invite-token/:code` | Ably token for `private-match:{code}`, so the inviter hears `match_found` / `invite_declined` / `invite_cancelled` live. |

Private matches skip the queue and the ack handshake: accepting starts an `ACTIVE` match straight away with the invite's `duration`, both ratings snapshotted for Elo, and the same result/forfeit endpoints settle it.

How a match runs:

1. The sweep pairs the oldest waiting player with the closest rating inside a range that starts at ±100 and grows by 50 every 5 s. Stale entries (10 min) and players already in an active match are dropped from the queue.
2. `match_found` is published on `matchmaking:user:{id}` with the match id and paragraph.
3. Both players must show up within 8 s — an Ably `ack` message or a plain `GET /matches/:id` both count. When both are in, `startedAt` is set to `now + 3s` and `match_started` is published; otherwise the match is abandoned and whoever showed up is requeued.
4. Results are compared by WPM, then accuracy, then a draw. Elo uses K = 24 and ratings never go below 0. The final view is published as `match_finished` on `match:{id}`.

### Admin, announcements, analytics, uploads

| Method | Path | Notes |
| --- | --- | --- |
| `GET/POST/DELETE` | `/admin/contests[/:id]` | Admin contest management. |
| `POST` | `/admin/submit` | Add a practice passage. |
| `DELETE` | `/admin/:id` | Remove a practice passage. |
| `GET` | `/admin/users`, `/admin/users/:id` | List / read users. |
| `PATCH` | `/admin/users/:id/role`, `/restore` | Change role, restore soft-deleted user. |
| `DELETE` | `/admin/users/:id` | Soft delete a user. |
| `GET/POST/PATCH/DELETE` | `/announcements[/:id]` | Admin CRUD. |
| `GET` | `/analytics/summary`, `/analytics/timeseries` | Usage analytics. |
| `POST` | `/analytics/heartbeat` | Session heartbeat. |
| `POST` | `/uploads` | Image upload; persists `avatarUrl` and returns `{ url, publicId, user }`. |
| `POST` | `/uploads/avatar` | Alias with identical behaviour. |

Responses use a consistent envelope: `{ success, message, data }` for success paths and `{ success: false, statusCode, message }` for errors.

---

## Auth model

- Login issues `accessToken` (15 minutes) and `refreshToken` (15 days) as httpOnly cookies.
- `verifyToken` accepts the cookie or an `Authorization: Bearer` header, so scripts and Swagger work too.
- The client's middleware refreshes the access token before rendering protected pages; `/auth/refresh` rotates it server-side.
- Google sign-in exchanges a one-time authorization code, then issues the same cookie pair.
- Passwords are hashed with bcrypt; OTP codes are short-lived, hashed, and stored in Redis with attempt counters and resend cooldowns.
- Refresh tokens are tracked in Redis per user, so logout and re-login invalidate older sessions.

---

## Roles and guards

| Role | Can |
| --- | --- |
| `USER` | Practice, submit results, join and leave contests, leave contest results. |
| `ORG` | Everything a user can do, plus create contests. |
| `ADMIN` | Full admin surface: contests, passages, users, announcements. |

Guards compose on routes, e.g. `router.post("/", verifyToken, verifyRole("ORG"), handler)`. `verifyToken` reads the access token from the cookie first and falls back to `Authorization: Bearer`, so scripts and Swagger can call protected routes without a browser.

---

## Rate limits

| Limiter | Window | Limit |
| --- | --- | --- |
| Global | 1 minute | 110 requests |
| Login | 15 minutes | 15 attempts |
| Signup | 1 hour | 30 attempts |
| Result submit | 1 minute | 5 submissions |

Limiters use `express-rate-limit`'s in-memory store, so counters are per process and reset on restart. Running more than one instance behind a load balancer would need a shared Redis store to keep the numbers accurate.

---

## Leaderboards

- Every result stores `duration` — the run length the typist chose. Boards are split by it so a 15 s sprint never competes with a 60 s run.
- `GET /practices/results` filters by `duration` and paginates with `offset`; the client shows one category at a time.
- `GET /contests/:id/leaderboard` returns each participant's best run only, so a typist appears once per contest.
- Contest runs (`POST /contests/:id/submit`) are stored against both the contest and the user, and are excluded from practice boards.

---

## Uploads

`POST /uploads` (alias `/uploads/avatar`):

1. `verifyToken` ensures a signed-in caller.
2. Multer streams the file to Cloudinary with a 10 MB cap.
3. The returned `secure_url` is written to `User.avatarUrl`.
4. Response: `{ url, publicId, user }` — `url` stays at the root for older clients.

Multer and Cloudinary errors are mapped: unsupported type → `400`, too large → `413`, Cloudinary permission failure → `502` with an actionable message. The Cloudinary API key must include the `create` action; a read-only key returns `403` from Cloudinary and will fail every upload.

---

## Data model

```
User ──< Result >── Paragraph          Contest ──< ContestParticipant >── User
 │        │                              │
 │        └── Contest                    └──< Result
 └──< Announcement
```

| Model | Key fields |
| --- | --- |
| `User` | `name`, `fullName`, `email` (unique), `password?`, `country`, `googleId`, `authProvider`, `emailVerified`, `avatarUrl`, `bio`, `xp`, `role`, `isDelete` |
| `Result` | `wpm`, `accuracy`, `errors`, `timeTaken`, `duration`, optional `paragraphId` / `contestId` / `userId` |
| `Paragraph` | `content`, `language`, `category`, `difficulty`, `wordCount`, `isDeleted` |
| `Contest` | `name`, `content`, `time` (seconds), `contestDate`, `condition` (`UPCOMING`/`RUNNING`/`FINISHED`), `userId` |
| `ContestParticipant` | composite `(userId, contestId)`, `joinedAt` |
| `Announcement` | `message`, `isActive`, optional author |

Indexes cover `Result.userId`, `Result.paragraphId`, `Result.contestId`, `Result.duration`, and `ContestParticipant(userId, contestId)`.

---

## Deployment

### Render

- **Build command:** `npx prisma generate && npx tsc -p tsconfig.json`
- **Start command:** `node dist/app/server.js`
- **Health:** the service must expose `PORT`; Redis and Postgres URLs come from the environment group.
- Run `npx prisma migrate deploy` on release (the Docker image already does this).

### Docker

Multi-stage build (`deps → build → prod-deps → runtime`) with `prisma generate` in each relevant stage and `prisma migrate deploy` in the entrypoint.

### Checklist before shipping

```bash
npx tsc --noEmit
npm run lint
npx prisma migrate deploy
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Upload returns `502` / `500` "unexpected status code - 403" | Cloudinary key lacks `create` permission. | Issue a key with upload rights and update Render's env vars. |
| Login succeeds but protected calls return `401` | `JWT_SECRET_FOR_ACCESS_TOKEN` differs between instances, or cookies are blocked. | Use one secret everywhere; verify the client proxy forwards cookies. |
| `P1001` / Prisma connection error | `DATABASE_URL` wrong or database asleep. | Check the connection string and provider limits. |
| `REDIS_URL is not set` on boot | Redis config is required at startup. | Provide a reachable Redis URL (local or managed). |
| OTP or stats endpoints hang | Redis unreachable; OTP state and caches live there. | Check the Redis host/credentials and TLS prefix (`rediss://`). |
| OTP emails never arrive | Brevo key or `MAIL_FROM` invalid. | Verify the sender domain and API key in Brevo. |
| `Port number required` on boot | `PORT` missing. | Set `PORT` in `.env` or the platform environment. |

---

## Roadmap

- Battle history and rating graphs on the client (matches are already stored)
- Persisted announcements feed for non-admin users
- Team/organisation contest management
- Real-time leaderboard pushes instead of polling
- Stricter request schemas across every module

---

## License

Private project — all rights reserved.
