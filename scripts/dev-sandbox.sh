#!/usr/bin/env bash
# Run a Eir instance in an isolated sandbox — separate EIR_HOME,
# separate Electron userData, and a distinct Desktop app name so it doesn't compete
# with your main desktop instance's single-instance lock.
#
# By default the sandbox is throwaway: a temp dir is created and removed on
# exit. Use --persistent to keep the sandbox across restarts (stored under
# .eir-sandbox/ in the worktree git root).
#
# Usage:
#   scripts/dev-sandbox.sh python -m eir_cli.main
#   scripts/dev-sandbox.sh eir desktop
#   scripts/dev-sandbox.sh electron .
#   scripts/dev-sandbox.sh -- pnpm run dev   # from apps/desktop/
#   scripts/dev-sandbox.sh --persistent eir desktop
#   scripts/dev-sandbox.sh --persistent -- pnpm run dev
#
# Seed the sandbox EIR_HOME from an existing directory (e.g. your main
# ~/.eir) so config, sessions, skills, etc. are pre-populated:
#   scripts/dev-sandbox.sh --from ~/.eir eir desktop
#
# Override the app name (default: EirSandbox):
#   EIR_DEV_SANDBOX_NAME=Staging scripts/dev-sandbox.sh eir desktop
#
# Override the persistent sandbox dir name (default: .eir-sandbox):
#   EIR_DEV_SANDBOX_DIR=.staging-sandbox scripts/dev-sandbox.sh --persistent eir desktop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTRYPOINT="$(basename "$0")"
# The minimal entrypoint is an alias, but its existing data and app identity stay separate.
if [ "$ENTRYPOINT" = dev-minimal-sandbox.sh ]; then
  DEFAULT_DIR=.eir-minimal-sandbox
  APP_PREFIX=EirMinimalSandbox
  TEMP_PREFIX=eir-minimal-sandbox
else
  DEFAULT_DIR=.eir-sandbox
  APP_PREFIX=EirSandbox
  TEMP_PREFIX=eir-sandbox
fi

print_help() {
  cat <<EOF
Usage: $ENTRYPOINT [--persistent] [--from DIR] [--] <command...>

Run a Eir instance in an isolated sandbox.

Options:
  --persistent    Keep the sandbox dir across restarts (under the worktree
                  git root, in $DEFAULT_DIR/). Without this flag the
                  sandbox is a temp dir that is removed on exit.
  --from DIR      Copy DIR into the sandbox EIR_HOME as the starting
                  point (config, sessions, skills, etc.).
                  Ignored if the sandbox EIR_HOME already has content
                  (e.g. reusing a --persistent sandbox) to avoid clobbering.
  --delete        Delete the existing persistent sandbox in $DEFAULT_DIR.
  -h, --help      Show this help message.

Environment:
  EIR_DEV_SANDBOX_NAME  Override the app name (default prefix: $APP_PREFIX)
  EIR_DEV_SANDBOX_DIR   Override the persistent dir name (default: $DEFAULT_DIR)

Examples:
  $ENTRYPOINT eir desktop
  $ENTRYPOINT --persistent eir desktop
  $ENTRYPOINT --from ~/.eir eir desktop
  $ENTRYPOINT -- pnpm run dev
EOF
}

PERSISTENT=false
DELETE=false
SEED_DIR=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --persistent)
      PERSISTENT=true
      shift
      ;;
    --from)
      if [ "$#" -lt 2 ] || [[ "$2" == -* ]]; then
        echo "error: --from requires a directory argument" >&2
        exit 1
      fi
      SEED_DIR="$2"
      shift 2
      ;;
    --from=*)
      SEED_DIR="${1#--from=}"
      if [ -z "$SEED_DIR" ]; then
        echo "error: --from requires a directory argument" >&2
        exit 1
      fi
      shift
      ;;
    --delete)
      DELETE=true
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [ -n "$SEED_DIR" ]; then
  if [ ! -d "$SEED_DIR" ]; then
    echo "error: --from dir '$SEED_DIR' does not exist" >&2
    exit 1
  fi
  # Resolve to absolute path so it's valid after we cd later.
  SEED_DIR="$(cd "$SEED_DIR" && pwd)"
fi

if [ "$#" -eq 0 ]; then
  print_help >&2
  exit 1
fi


SANDBOX_DIR_NAME="${EIR_DEV_SANDBOX_DIR:-$DEFAULT_DIR}"
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"
GIT_ROOT="$(cd "$GIT_ROOT" && pwd)"
PERSISTENT_SANDBOX_ROOT="$GIT_ROOT/$SANDBOX_DIR_NAME"

if [ "$DELETE" = true ]; then
  if [ -d "$PERSISTENT_SANDBOX_ROOT" ]; then
    read -r -p "[sandbox] delete $PERSISTENT_SANDBOX_ROOT? [y/N] " REPLY
    case "$REPLY" in
      [yY]|[yY][eE][sS])
        echo "[sandbox] deleting $PERSISTENT_SANDBOX_ROOT" >&2
        rm -rf -- "$PERSISTENT_SANDBOX_ROOT"
        ;;
      *)
        echo "[sandbox] aborted" >&2
        exit 1
        ;;
    esac
  else
    echo "[sandbox] nothing to delete at $PERSISTENT_SANDBOX_ROOT" >&2
  fi
  exit 0
fi

# Derive a per-worktree app name so multiple checkouts don't collide.
# Each worktree has its own toplevel path even though they share one repo,
# so we hash that path into a short, stable suffix.
WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"
WORKTREE_ROOT="$(cd "$WORKTREE_ROOT" && pwd)"
WORKTREE_HASH="$(printf '%s' "$WORKTREE_ROOT" | cksum | cut -d' ' -f1)"
WORKTREE_NAME="$(basename "$WORKTREE_ROOT")"
DEFAULT_SANDBOX_NAME="${APP_PREFIX}-${WORKTREE_NAME}-${WORKTREE_HASH}"

SANDBOX_NAME="${EIR_DEV_SANDBOX_NAME:-$DEFAULT_SANDBOX_NAME}"

if [ "$PERSISTENT" = true ]; then
  SANDBOX_ROOT="$PERSISTENT_SANDBOX_ROOT"
else
  SANDBOX_ROOT="$(mktemp -d -t "${TEMP_PREFIX}.XXXXXX")"
fi

export EIR_HOME="$SANDBOX_ROOT/eir-home"
export EIR_DESKTOP_USER_DATA_DIR="$SANDBOX_ROOT/user-data"
export EIR_DESKTOP_APP_NAME="$SANDBOX_NAME"

mkdir -p "$EIR_HOME" "$EIR_DESKTOP_USER_DATA_DIR"

if [ -n "$SEED_DIR" ]; then
  # Only seed when the sandbox EIR_HOME is empty — avoids clobbering an
  # existing persistent sandbox on re-run.
  if [ -z "$(ls -A "$EIR_HOME" 2>/dev/null)" ]; then
    echo "[sandbox] seeding EIR_HOME from $SEED_DIR" >&2
    cp -a "$SEED_DIR/." "$EIR_HOME/"
  else
    echo "[sandbox] --from ignored: $EIR_HOME already has content" >&2
  fi
fi

echo "[sandbox] EIR_HOME=$EIR_HOME" >&2
echo "[sandbox] userData=$EIR_DESKTOP_USER_DATA_DIR" >&2
echo "[sandbox] appName=$EIR_DESKTOP_APP_NAME" >&2
if [ "$PERSISTENT" = true ]; then
  echo "[sandbox] persistent: $SANDBOX_ROOT" >&2
else
  echo "[sandbox] ephemeral (will be cleaned up on exit)" >&2
fi

if [ "$PERSISTENT" = false ]; then
  # shellcheck disable=SC2329  # invoked via trap
  cleanup() {
    chmod -R u+w "$SANDBOX_ROOT"
    rm -rf -- "$SANDBOX_ROOT"
  }
  trap cleanup EXIT
  trap 'cleanup; exit 130' INT TERM
fi

"$@"
rc=$?
exit $rc