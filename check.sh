#!/usr/bin/env bash
# Replays THIS repo's CI security checks LOCALLY, at the SAME pinned versions.
# Goal: local == github. What passes here passes CI — no more "green locally, red on GitHub".
#
# AUTO-DETECTING: it reads `.github/workflows/ci.yml` and runs ONLY what that CI runs
# (shellcheck, actionlint, zizmor, semgrep, osv-scanner, gitleaks — depending on the markers present).
# So a SINGLE file serves the template AND every generated project (node/static/generic/Android/C++…).
# The ONLY deliberate addition: it also validates any `renovate.json` present — to catch the failure
# mode "broken Renovate config → silent freeze of updates", which a project's CI does not cover.
#
# Versions are NEVER hardcoded: read from `ci.yml` (+ `requirements-ci.txt`). Binaries are cached
# under `.ci-tools/` (gitignored). CI itself verifies the SHA256 of the Linux asset; here we pin the
# VERSION (same rules → same findings) and verify it via `--version`. The strong checksum stays CI's
# job, the authority. This script is a pre-flight, not the barrier.
set -euo pipefail
cd "$(dirname "$0")"

CI=.github/workflows/ci.yml
CACHE=.ci-tools
mkdir -p "$CACHE"
[ -f "$CI" ] || { echo "No $CI here — nothing to replay."; exit 0; }

os=$(uname -s | tr '[:upper:]' '[:lower:]')          # darwin | linux
uarch=$(uname -m)
gl_arch=arm64; al_arch=arm64; osv_arch=arm64
[ "$uarch" = x86_64 ] && { gl_arch=x64; al_arch=amd64; osv_arch=amd64; }

fail=0
note() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
ko()   { printf '  \033[31m✗ %s\033[0m\n' "$1"; fail=1; }

pin()   { grep -m1 "^[[:space:]]*$1:" "$CI" | awk '{print $2}' || true; }   # a `NAME: value` env from ci.yml (empty if absent)
in_ci() { grep -v '^[[:space:]]*#' "$CI" | grep -q -- "$1"; }        # does CI run this tool? (excluding comments)

# Pip versions file (zizmor/semgrep): the repo's if it exists, otherwise the template's.
reqfile=requirements-ci.txt
[ -f "$reqfile" ] || reqfile=templates/repo/requirements-ci.txt
# Zizmor config: the repo's, otherwise the shipped one (the template lints its own workflow with it).
zconfig=.github/zizmor.yml
[ -f "$zconfig" ] || zconfig=templates/repo/.github/zizmor.yml

ensure_gitleaks() {
  local tag="$1" v="${1#v}" bin="$CACHE/gitleaks"
  if [ -x "$bin" ] && "$bin" version 2>/dev/null | grep -q "$v"; then return; fi
  local f="gitleaks_${v}_${os}_${gl_arch}.tar.gz"
  curl -sSfL -o "$CACHE/$f" "https://github.com/gitleaks/gitleaks/releases/download/${tag}/${f}"
  tar -xzf "$CACHE/$f" -C "$CACHE" gitleaks; rm -f "$CACHE/$f"
}
ensure_actionlint() {
  local tag="$1" v="${1#v}" bin="$CACHE/actionlint"
  if [ -x "$bin" ] && "$bin" --version 2>/dev/null | grep -q "$v"; then return; fi
  local f="actionlint_${v}_${os}_${al_arch}.tar.gz"
  curl -sSfL -o "$CACHE/$f" "https://github.com/rhysd/actionlint/releases/download/${tag}/${f}"
  tar -xzf "$CACHE/$f" -C "$CACHE" actionlint; rm -f "$CACHE/$f"
}
ensure_osv() {
  local tag="$1" v="${1#v}" bin="$CACHE/osv-scanner"
  if [ -x "$bin" ] && "$bin" --version 2>/dev/null | grep -q "$v"; then return; fi
  curl -sSfL -o "$bin" "https://github.com/google/osv-scanner/releases/download/${tag}/osv-scanner_${os}_${osv_arch}"
  chmod +x "$bin"
}
# Shared Python venv for zizmor and semgrep; only reinstalls if a version is missing.
ensure_venv() {
  local need=0 spec tool ver
  [ -d "$CACHE/venv" ] || { python3 -m venv "$CACHE/venv"; need=1; }
  for spec in "$@"; do
    tool="${spec%%==*}"; ver="${spec#*==}"
    "$CACHE/venv/bin/$tool" --version 2>/dev/null | grep -q "$ver" || need=1
  done
  [ "$need" = 0 ] && return
  "$CACHE/venv/bin/pip" install --quiet --upgrade pip >/dev/null
  "$CACHE/venv/bin/pip" install --quiet "$@"
}

GITLEAKS_VERSION=$(pin GITLEAKS_VERSION)
ACTIONLINT_VERSION=$(pin ACTIONLINT_VERSION)
OSV_VERSION=$(pin OSV_VERSION)
ZIZMOR_SPEC=$(grep -m1 '^zizmor==' "$reqfile" 2>/dev/null || true)
SEMGREP_SPEC=$(grep -m1 '^semgrep==' "$reqfile" 2>/dev/null || true)
RENOVATE_PKG=$(grep -m1 -o 'renovate@[0-9]*' "$CI" | head -1 || true)
[ -n "$RENOVATE_PKG" ] || RENOVATE_PKG=renovate@43.278.0

note "Pinned tools (auto-detected from $CI)"
[ -n "$GITLEAKS_VERSION" ]   && ensure_gitleaks "$GITLEAKS_VERSION"
[ -n "$ACTIONLINT_VERSION" ] && ensure_actionlint "$ACTIONLINT_VERSION"
if in_ci osv-scanner && [ -n "$OSV_VERSION" ]; then ensure_osv "$OSV_VERSION"; fi
venv_specs=()
if in_ci zizmor  && [ -n "$ZIZMOR_SPEC" ];  then venv_specs+=("$ZIZMOR_SPEC");  fi
if in_ci semgrep && [ -n "$SEMGREP_SPEC" ]; then venv_specs+=("$SEMGREP_SPEC"); fi
[ "${#venv_specs[@]}" -gt 0 ] && ensure_venv "${venv_specs[@]}"
ok "ready under $CACHE/"

if in_ci shellcheck; then
  note "shellcheck — shell scripts"
  targets=()
  while IFS= read -r f; do targets+=("$f"); done < <(
    find . -type f -name '*.sh' -not -path './.ci-tools/*' -not -path './.git/*' -not -path './node_modules/*')
  if [ -d .githooks ]; then while IFS= read -r f; do targets+=("$f"); done < <(find .githooks -type f); fi
  if [ "${#targets[@]}" -eq 0 ]; then ok "no shell scripts"
  elif ! command -v shellcheck >/dev/null 2>&1; then ko "shellcheck missing — 'brew install shellcheck'"
  elif shellcheck -S warning "${targets[@]}"; then ok "shellcheck"; else ko "shellcheck"; fi
fi

if in_ci actionlint && [ -d .github/workflows ]; then
  note "actionlint — workflows"
  if "$CACHE/actionlint" -color; then ok "actionlint"; else ko "actionlint"; fi
fi

if in_ci zizmor && [ -d .github/workflows ]; then
  note "zizmor — workflows (config $zconfig)"
  if "$CACHE/venv/bin/zizmor" --persona regular --config "$zconfig" .github/workflows/; then ok "zizmor"; else ko "zizmor"; fi
fi

if in_ci semgrep; then
  note "semgrep — the code (curated packs)"
  if "$CACHE/venv/bin/semgrep" scan --error --quiet --metrics=off --exclude=.github \
       --config p/security-audit --config p/owasp-top-ten .; then ok "semgrep"; else ko "semgrep"; fi
fi

if in_ci osv-scanner; then
  note "osv-scanner — dependencies (all manifests)"
  if "$CACHE/osv-scanner" scan source -r . --allow-no-lockfiles; then ok "osv"; else ko "osv"; fi
fi

if [ -n "$GITLEAKS_VERSION" ]; then
  note "gitleaks — full history"
  if "$CACHE/gitleaks" git --no-banner --redact; then ok "gitleaks"; else ko "gitleaks"; fi
fi

# renovate-config-validator — whenever a renovate.json exists (beyond a project's CI: anti silent-freeze).
renovate_files=()
while IFS= read -r f; do renovate_files+=("$f"); done < <(
  find . -type f -name 'renovate.json' -not -path './.ci-tools/*' -not -path './.git/*' -not -path './node_modules/*')
if [ "${#renovate_files[@]}" -gt 0 ]; then
  note "renovate-config-validator — ${#renovate_files[@]} config(s)"
  rv=1
  for f in "${renovate_files[@]}"; do
    npx --yes --package "$RENOVATE_PKG" renovate-config-validator "$f" >/dev/null 2>&1 || rv=0
  done
  [ "$rv" = 1 ] && ok "renovate configs valid" || ko "renovate config invalid"
fi

echo
if [ "$fail" = 0 ]; then
  printf '\033[32m✓ local == github: all pass.\033[0m\n'
else
  printf '\033[31m✗ gaps above — CI will block on push.\033[0m\n'; exit 1
fi
