#!/usr/bin/env bash
#
# apply-new-addresses.sh <NEW_ARENA> <NEW_SCHEDULER>
#
# Rewrites every off-chain reference from the OLD Arena/Scheduler to the new ones, AFTER the
# Phase-5 redeploy (RedeployArenaLiveness.s.sol) has produced the new addresses. Idempotent.
set -euo pipefail

NEW_ARENA="${1:?usage: apply-new-addresses.sh <NEW_ARENA> <NEW_SCHEDULER>}"
NEW_SCHED="${2:?usage: apply-new-addresses.sh <NEW_ARENA> <NEW_SCHEDULER>}"

OLD_ARENA="0xaa8a0cf920a3ce19ebaa5127f4e40cb049c94858"
OLD_SCHED="0x0fdad151de1e8357338f850978b148d09c4a243d"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# lowercase the inputs to match the stored (lowercased) addresses
NEW_ARENA="$(echo "$NEW_ARENA" | tr '[:upper:]' '[:lower:]')"
NEW_SCHED="$(echo "$NEW_SCHED" | tr '[:upper:]' '[:lower:]')"

repl() { # file
  local f="$1"; [ -f "$f" ] || { echo "skip (missing): $f"; return; }
  sed -i \
    -e "s/${OLD_ARENA}/${NEW_ARENA}/Ig" \
    -e "s/${OLD_SCHED}/${NEW_SCHED}/Ig" "$f"
  echo "updated: ${f#$ROOT/}"
}

# Functional configs (must match the deployed addresses for the app to work)
repl "$ROOT/frontend/src/chain/config.ts"
repl "$ROOT/.env"
repl "$ROOT/indexer/subgraph.yaml"
repl "$ROOT/starter-kit/template/.env.example"

echo
echo "done. Functional configs re-pointed to:"
echo "  arena     $NEW_ARENA"
echo "  scheduler $NEW_SCHED"
echo "Docs (README.md, TODO.md, docs/*.md) still reference the old address as historical record —"
echo "update those by hand only if you want them to read as current."
