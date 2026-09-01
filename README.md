# TypeRush Backend

Real-time multiplayer typing race backend built with Node.js, TypeScript, Express, and Socket.IO.

## Overview

TypeRush is a competitive typing speed platform. This backend powers real-time races, user accounts, and live leaderboards.

## Tech Stack

| Layer            | Technology                     |
|-------------------|---------------------------------|
| Runtime           | Node.js + TypeScript            |
| Web framework     | Express                         |
| Real-time         | Socket.IO                       |
| Database          | MongoDB (Mongoose)              |
| Cache / Leaderboards | Redis                        |
| Auth              | JWT + bcrypt                    |
| Validation        | Zod                             |
| Containerization  | Docker + Docker Compose         |
| CI/CD             | GitHub Actions                  |

## Project Structure

```
typerush-backend/
├── src/
│   ├── config/          # env, database, redis setup
│   ├── modules/          # feature-based modules (auth, user, race, leaderboard)
│   ├── sockets/           # socket.io server setup and middleware
│   ├── middleware/       # auth, error handling, rate limiting
│   ├── common/            # shared errors, utils, types
│   ├── app.ts             # express app setup
│   └── server.ts          # entrypoint
├── tests/
├── docker-compose.yml
├── Dockerfile
└── tsconfig.json
```

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB instance (local or remote)
- Redis instance (local or remote)

### Installation

```bash
git clone <repo-url>
cd typerush-backend
npm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/typerush
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
```

### Running Locally

```bash
npm run dev
```

Server starts on `http://localhost:5000` by default.

### Running with Docker

```bash
docker-compose up --build
```

This spins up the app, MongoDB, and Redis together.

## Available Scripts

| Command          | Description                          |
|-------------------|----------------------------------------|
| `npm run dev`      | Start dev server with hot reload       |
| `npm run build`    | Compile TypeScript to `dist/`          |
| `npm start`        | Run compiled production build          |
| `npm run lint`     | Run ESLint                             |
| `npm test`         | Run test suite                         |

## Core Features

- **Auth** — JWT-based registration/login
- **Races** — Real-time multiplayer typing races via Socket.IO rooms
- **Leaderboards** — Redis sorted sets for live rankings
- **User profiles** — Stats, history, and progress tracking

## API Documentation

_(Add Swagger/OpenAPI link or endpoint list here once routes are finalized.)_

## Branching & Workflow

- `dev` — active development branch
- `main` — production-ready, deployed branch

All changes are developed on `dev`, validated by CI, and merged into `main` via pull request once stable.

## Contributing

1. Create a feature branch from `dev`
2. Commit changes with clear messages
3. Push and open a PR into `dev`
4. Ensure CI passes before merge

## License

_(Add license type, e.g. MIT, or mark as proprietary.)_

## Author

Built by Sakib — Seven Venture Labs
