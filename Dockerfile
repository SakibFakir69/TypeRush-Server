
# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app

# ---- Dependencies (with dev deps, for build) ----
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
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
RUN npm ci --omit=dev

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/app/server.js"]
