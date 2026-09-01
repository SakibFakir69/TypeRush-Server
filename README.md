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
