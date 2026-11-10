# syntax=docker/dockerfile:1
# API and Socket.IO on one port. Build context is the repository root, because the server
# depends on the shared workspace.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# scripts are skipped: husky has no git here, and mongodb-memory-server is a test-only binary
RUN npm ci --workspace=shared --workspace=server --include-workspace-root --ignore-scripts

COPY shared shared
COPY server server
RUN npm run build --workspace=shared && npm run build --workspace=server

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace=shared --workspace=server --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist

# never root inside the container
USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server/dist/index.js"]
