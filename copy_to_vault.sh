#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
VAULT="${1:-${OBSIDIAN_VAULT:-$HOME/Desktop/Obsidian}}"
CHECK=0

if [[ "${1:-}" == "--check" ]]; then
  CHECK=1
  VAULT="${OBSIDIAN_VAULT:-$HOME/Desktop/Obsidian}"
elif [[ "${2:-}" == "--check" ]]; then
  CHECK=1
elif [[ $# -gt 2 ]]; then
  printf 'Usage: %s [vault] [--check]\n' "$0" >&2
  exit 2
fi

[[ "$(id -u)" -ne 0 ]] || {
  echo "Run as the desktop owner, not root." >&2
  exit 77
}
[[ -d "$VAULT/.obsidian" ]] || {
  printf 'Obsidian vault unavailable: %s\n' "$VAULT" >&2
  exit 2
}

for path in "$ROOT/manifest.json" "$ROOT/styles.css" "$ROOT/main.js"; do
  [[ -f "$path" && ! -L "$path" ]] || {
    printf 'Required built plugin file unavailable: %s\n' "$path" >&2
    exit 2
  }
done
command -v node >/dev/null 2>&1 || {
  echo "node is required to validate the built plugin" >&2
  exit 2
}
node --check "$ROOT/main.js"

PLUGIN_ID="$(node -e 'const m=require(process.argv[1]); if(!m.id) process.exit(2); process.stdout.write(m.id)' "$ROOT/manifest.json")"
VERSION="$(node -e 'const m=require(process.argv[1]); if(!m.version) process.exit(2); process.stdout.write(m.version)' "$ROOT/manifest.json")"
[[ "$PLUGIN_ID" == "3d-graph" ]] || {
  printf 'Unexpected plugin id: %s\n' "$PLUGIN_ID" >&2
  exit 2
}

PLUGIN_ROOT="$VAULT/.obsidian/plugins"
TARGET="$PLUGIN_ROOT/$PLUGIN_ID"
BACKUP_ROOT="$PLUGIN_ROOT/.3d-graph-backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if (( CHECK )); then
  printf 'PLUGIN_INSTALL_CHECK=PASS id=%s version=%s target=%s\n' "$PLUGIN_ID" "$VERSION" "$TARGET"
  exit 0
fi

mkdir -p -- "$TARGET" "$BACKUP_ROOT"
if [[ -f "$TARGET/main.js" || -f "$TARGET/manifest.json" || -f "$TARGET/styles.css" ]]; then
  BACKUP="$BACKUP_ROOT/$STAMP"
  mkdir -p -- "$BACKUP"
  for name in main.js manifest.json styles.css; do
    if [[ -f "$TARGET/$name" && ! -L "$TARGET/$name" ]]; then
      cp --preserve=mode,timestamps -- "$TARGET/$name" "$BACKUP/$name"
    fi
  done
fi

STAGE="$(mktemp -d "$PLUGIN_ROOT/.3d-graph-install.XXXXXX")"
cleanup() {
  rm -rf -- "$STAGE"
}
trap cleanup EXIT

install -m 0644 "$ROOT/main.js" "$STAGE/main.js"
install -m 0644 "$ROOT/manifest.json" "$STAGE/manifest.json"
install -m 0644 "$ROOT/styles.css" "$STAGE/styles.css"
node --check "$STAGE/main.js"

for name in main.js manifest.json styles.css; do
  mv -f -- "$STAGE/$name" "$TARGET/$name"
done
printf '%s\n' "$VERSION" > "$TARGET/.intelligence-graph-version"
touch "$TARGET/.hotreload"

MAIN_SHA="$(sha256sum "$TARGET/main.js" | awk '{print $1}')"
printf 'PLUGIN_INSTALL_STATUS=PASS id=%s version=%s main_sha256=%s target=%s\n' \
  "$PLUGIN_ID" "$VERSION" "$MAIN_SHA" "$TARGET"
