# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# Prisma's query/schema engine needs openssl on Alpine (musl)
RUN apk add --no-cache openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches patches
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# ---- dev: used by docker-compose.override.yml for local hot-reload ----
FROM base AS dev
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ---- build: compiles the Nest app ----
FROM base AS build
RUN pnpm build

# ---- prod: minimal runtime image, what gets pushed to Docker Hub ----
FROM node:22-alpine AS prod
RUN apk add --no-cache openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
ENV NODE_ENV=production

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches patches
RUN pnpm install --frozen-lockfile --prod --filter @cockpit/api...

COPY apps/api/prisma apps/api/prisma
# @cockpit/shared publishes raw TypeScript (its package.json `exports` point at
# src/*.ts, which is what Vite and ts-jest consume in dev). The compiled API
# still `require`s it at runtime, so the sources have to ship in the runtime
# image too — Node 22 strips the types on load. Without this the image builds
# fine and then dies on boot with MODULE_NOT_FOUND @cockpit/shared.
COPY packages/shared/src packages/shared/src
COPY --from=build /app/apps/api/generated apps/api/generated
COPY --from=build /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
