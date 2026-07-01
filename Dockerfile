# node:26-alpine (linux/amd64 + linux/arm64), multi-arch OCI index, pinned 2026-06-23 — Dependabot updates.
# Alpine over -slim saves ~96 MB (~28%); the image floor is the node binary + stellar-sdk prod deps.
FROM node:26-alpine@sha256:725aeba2364a9b16beae49e180d83bd597dbd0b15c47f1f28875c290bfd255b9 AS build
WORKDIR /app
# Build-only native toolchain: a transitive devDep (trezor -> usb, via @creit.tech/stellar-wallets-kit,
# used only to pre-build the committed walletkit.js) needs libusb/eudev to compile under musl.
# None of this is carried into the runtime stage.
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev libusb-dev
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY core ./core
COPY collector ./collector
COPY db ./db
COPY cli ./cli
COPY web ./web
RUN npm run build
# Drop devDeps (incl. the native usb chain). Prod deps are effectively pure-JS under musl:
# the optional sodium-native addon ships no musl prebuild, so stellar-base falls back to
# tweetnacl — fine here, signing happens wallet-side, never server-side.
RUN npm prune --omit=dev

FROM node:26-alpine@sha256:725aeba2364a9b16beae49e180d83bd597dbd0b15c47f1f28875c290bfd255b9 AS runtime
ARG REV
ENV APP_REV=${REV:-dev}
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION:-dev}
WORKDIR /app
ENV NODE_ENV=production
ENV SQLITE_TMPDIR=/tmp
# Copy the pruned prod node_modules from build (runtime has no toolchain; no native addon
# loads under musl — stellar-base uses its tweetnacl fallback).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY web/public ./dist/web/public
COPY package.json ./
# root:root (deliberate) — custom container users explored and rejected (too much volume-ownership
# friction). Hardening lives in the compose directives: cap_drop ALL, read_only, no-new-privileges, tmpfs.
CMD ["node", "dist/collector/daemon.js"]
