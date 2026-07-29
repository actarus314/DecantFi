# node:26-alpine (linux/amd64 + linux/arm64), multi-arch OCI index, pinned 2026-06-23 — Dependabot updates.
# Alpine over -slim saves ~96 MB (~28%); the image floor is the node binary + stellar-sdk prod deps.
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS build
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
#
# `--omit=optional` as well, and that one is a SECURITY measure rather than a size one. Every
# optional package left in the prod tree is either already unusable in this image or purely
# decorative, while one chain carries a live advisory whose fix cannot be reached:
#   · sodium-native — no musl prebuild (see above), so it never loads here anyway;
#   · bunyan's mv / moment / dtrace-provider / safe-json-stringify — bunyan `require()`s each one
#     inside a try/catch and degrades gracefully (mv powers only its rotating-file stream, which
#     nothing here uses; moment is used by its CLI, not its library);
#   · mv drags rimraf@2.4 -> glob@6 -> minimatch@3 -> brace-expansion@1, i.e. GHSA-mh99-v99m-4gvg.
#     Unfixable in place: every version below brace-expansion 5.0.8 is affected, and forcing 5.0.8
#     breaks minimatch@3 (v5 exports `{ expand }`, v3 expects the function itself).
# Pruning is therefore the real remediation; osv-scanner.toml records what stays in the lockfile,
# why, and the verification that none of that chain ships in the built image.
RUN npm prune --omit=dev --omit=optional

FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS runtime
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
# npm is a BUILD tool, never a runtime one: nothing here shells out to it (the CMD, the compose
# command and both healthchecks all call `node` directly). Leaving it in ships npm's whole
# dependency tree — and its CVEs — into the runtime image: Trivy fails `build-check` on
# brace-expansion/tar/undici that belong to npm itself, not to this app.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm
# root:root (deliberate) — custom container users explored and rejected (too much volume-ownership
# friction). Hardening lives in the compose directives: cap_drop ALL, read_only, no-new-privileges, tmpfs.
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["node", "dist/collector/daemon.js"]
