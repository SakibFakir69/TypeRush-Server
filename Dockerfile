# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app

# ---- Dependencies (with dev deps, for build) ----
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---- Build ----
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev
RUN npx prisma generate

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package*.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app/server.js"]