#!/usr/bin/env bash
# Open a pull request AND make sure CI actually starts on it.
#
# GitHub intermittently fails to dispatch the `pull_request` workflow run when a PR
# is opened — even with a correct, unfiltered `pull_request:` trigger (observed
# across repos with identical valid config). A PR that received zero runs looks
# exactly like one that passed, and "0 runs" silently reads as "nothing wrong" — so
# it gets merged unchecked. This script closes that gap, in three moves:
#   1. wait until GitHub has registered the pushed head commit (shrinks the
#      push -> open race that causes most of the misses);
#   2. open the PR;
#   3. confirm a `pull_request` run was created — and if none appears, close and
#      reopen the PR once to re-fire the event. close/reopen is the ONLY re-trigger
#      that reproduces a repo's REQUIRED pull_request checks (e.g. checks,
#      build-check); a `workflow_dispatch` run does not satisfy a required
#      pull_request context.
#
# Usage:  ./open-pr.sh <base-branch> <title> <body-file>
#   Head = the current branch (already committed). Needs gh + git authenticated;
#   in this template's flow, run it under `direnv exec` from the repo dir so the .envrc PAT loads.
#
# This is a SHARED file: init-project.sh copies it verbatim into every generated
# project (like check.sh), so it is written in English regardless of the repo's language.
set -euo pipefail

BASE="${1:?usage: open-pr.sh <base-branch> <title> <body-file>}"
TITLE="${2:?usage: open-pr.sh <base-branch> <title> <body-file>}"
BODY_FILE="${3:?usage: open-pr.sh <base-branch> <title> <body-file>}"
[ -f "$BODY_FILE" ] || { echo "open-pr: body file not found: $BODY_FILE" >&2; exit 2; }

HEAD="$(git rev-parse --abbrev-ref HEAD)"
[ "$HEAD" != "$BASE" ] || { echo "open-pr: head and base are both '$BASE'" >&2; exit 2; }
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# Newest pull_request run id already attached to this branch (0 if none). Run ids are
# monotonic, so "a NEW run appeared" == "newest id > baseline". Id-based, not a count:
# a count with a page cap saturates on long-lived branches (e.g. develop, with >50
# prior runs) and would never detect a new run. Empty on a gh error (caller decides).
newest_run_id() {
  local v
  v="$(gh run list --branch "$HEAD" --event pull_request -L 1 --json databaseId --jq '.[0].databaseId // 0' 2>/dev/null)" || v=""
  case "$v" in ''|*[!0-9]*) echo "" ;; *) echo "$v" ;; esac
}

# Establish the baseline, failing CLOSED: if gh cannot answer after retries we must
# NOT proceed on a guess — a wrong baseline could later certify an unchecked PR as
# green, the exact harm this script exists to prevent. Abort before opening anything.
BASELINE=""
for _ in $(seq 1 5); do
  BASELINE="$(newest_run_id)"
  [ -n "$BASELINE" ] && break
  sleep 2
done
[ -n "$BASELINE" ] || { echo "open-pr: cannot read the run list to establish a baseline — aborting before opening the PR" >&2; exit 3; }

# Push the branch (idempotent) and let GitHub register the commit before opening the
# PR — opening too fast is the main cause of the missed dispatch.
git push -u origin "$HEAD"
SHA="$(git rev-parse HEAD)"
for _ in $(seq 1 15); do
  gh api "repos/$REPO/commits/$SHA" >/dev/null 2>&1 && break
  sleep 2
done

PR_URL="$(gh pr create --base "$BASE" --head "$HEAD" --title "$TITLE" --body-file "$BODY_FILE")"
PR="${PR_URL##*/}"
echo "open-pr: opened #$PR -> $PR_URL"

# Wait up to ~60 s for a NEW pull_request run to appear (id above the baseline). A gh
# error yields an empty id, which is treated as "not yet" — never as success, so the
# guard stays fail-closed throughout.
wait_for_dispatch() {
  local v
  for _ in $(seq 1 20); do
    v="$(newest_run_id)"
    [ -n "$v" ] && [ "$v" -gt "$BASELINE" ] && return 0
    sleep 3
  done
  return 1
}

if wait_for_dispatch; then
  echo "open-pr: CI dispatched."
else
  echo "open-pr: no pull_request run after ~45 s — known GitHub dispatch miss; re-firing (close/reopen)." >&2
  gh pr close "$PR"
  gh pr reopen "$PR"
  if wait_for_dispatch; then
    echo "open-pr: CI dispatched after reopen."
  else
    echo "open-pr: STILL no run after reopen — dispatch it manually and DO NOT merge on an empty check list." >&2
    exit 1
  fi
fi
echo "$PR_URL"
