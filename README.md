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
| Cache / limits | Redis (`redis` + `ioredis`) behind `express-rate-limit` |
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
        ├─▶ PostgreSQL (Prisma)
        └─▶ Redis (rate-limit counters)
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
- Redis (optional locally; rate limits degrade if absent)
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
| `REDIS_URL` | Yes | Redis connection string for rate limiting. |
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

### Admin, announcements, analytics, uploads

| Method | Path | Notes |
| --- | --- | --- |
| `GET/POST/DELETE` | `/admin/contests[/:id]` | Admin contest management. |
| `POST` | `/admin/submit` | Add a practice passage. |
| `DELETE` | `/admin/practices/:id` | Remove a passage. |
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
- Passwords are hashed with bcrypt; OTP codes are short-lived and delivered through Brevo.

---

## Roles and guards

| Role | Can |
| --- | --- |
| `USER` | Practice, submit results, join and leave contests, leave contest results. |
| `ORG` | Everything a user can do, plus create contests. |
| `ADMIN` | Full admin surface: contests, passages, users, announcements. |

Guards compose on routes, e.g. `router.post("/", verifyToken, verifyRole("ORG"), handler)`. A soft-deleted user (`isDelete`) is rejected by the token middleware.

---

## Rate limits

| Limiter | Window | Limit |
| --- | --- | --- |
| Global | 1 minute | 110 requests |
| Login | 15 minutes | 15 attempts |
| Signup | 1 hour | 30 attempts |
| Result submit | 1 minute | 5 submissions |

Counters live in Redis, so limits hold across Render instances.

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
| Rate limit errors in development | Redis counters shared across runs. | Flush the key prefix or point `REDIS_URL` at a local instance. |
| OTP emails never arrive | Brevo key or `MAIL_FROM` invalid. | Verify the sender domain and API key in Brevo. |
| `Port number required` on boot | `PORT` missing. | Set `PORT` in `.env` or the platform environment. |

---

## Roadmap

- Socket.IO matchmaking for 1v1 battles
- Persisted announcements feed for non-admin users
- Team/organisation contest management
- Real-time leaderboard pushes instead of polling
- Stricter request schemas across every module

---

## License

Private project — all rights reserved.
