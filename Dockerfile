# node:24-slim (linux/amd64 + linux/arm64), index multi-arch OCI, pinné 2026-06-22 — Dependabot met à jour
FROM node:26-slim@sha256:191ef878ecb351d68b78219593de18bd8942afd59af59f29960dc4b24805a3f1 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY core ./core
COPY collector ./collector
COPY db ./db
COPY cli ./cli
COPY web ./web
RUN npm run build

FROM node:26-slim@sha256:191ef878ecb351d68b78219593de18bd8942afd59af59f29960dc4b24805a3f1 AS runtime
ARG REV
ENV APP_REV=${REV:-dev}
WORKDIR /app
ENV NODE_ENV=production
ENV SQLITE_TMPDIR=/tmp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY web/public ./dist/web/public
# root:root (philosophie standard §14) ; durcissement via directives compose.
CMD ["node", "dist/collector/daemon.js"]
