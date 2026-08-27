# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY patches patches
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/shared packages/shared

# ---- dev: used by docker-compose.override.yml for local hot-reload ----
FROM base AS dev
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]

# ---- build: compiles the static Vite bundle ----
FROM base AS build
WORKDIR /app/apps/web
RUN pnpm build

# ---- prod: static bundle served by nginx, what gets pushed to Docker Hub ----
FROM nginx:1.31.4-alpine3.24 AS prod
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
