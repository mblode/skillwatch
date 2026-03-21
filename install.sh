#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_CLI="${SCRIPT_DIR}/dist/cli.js"

fail() {
  echo "$1" >&2
  exit 1
}

ensure_dist() {
  if [[ -f "${DIST_CLI}" ]]; then
    return
  fi

  if [[ ! -d "${SCRIPT_DIR}/node_modules" ]]; then
    fail "dist/cli.js is missing. Run 'npm install' first, then try again."
  fi

  (cd "${SCRIPT_DIR}" && npm run build)
}

ensure_dist

if [[ "${1:-}" == "--uninstall" ]]; then
  shift
  exec node "${DIST_CLI}" uninstall "$@"
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  exec node "${DIST_CLI}" --help
fi

if [[ "${1:-}" == "install" || "${1:-}" == "uninstall" || "${1:-}" == "check-now" ]]; then
  exec node "${DIST_CLI}" "$@"
fi

exec node "${DIST_CLI}" install "$@"
