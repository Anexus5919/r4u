# syntax=docker/dockerfile:1
# The built SPA behind nginx, which also proxies /api and /socket.io to the server, so the
# browser sees one origin and the refresh cookie stays same-site. Context is the repository root.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json .npmrc ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=client --include-workspace-root --ignore-scripts

COPY shared shared
COPY client client

# empty means same origin, which is what the nginx proxy provides
ARG VITE_SOCKET_URL=
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
RUN npm run build --workspace=client

FROM nginx:1.27-alpine AS runtime

# nginx substitutes ${API_UPSTREAM} from the environment when it renders this template
ENV API_UPSTREAM=server:5000
COPY client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
