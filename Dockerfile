# syntax=docker/dockerfile:1
FROM node:24-slim AS build
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

FROM node:24-slim AS runtime
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
