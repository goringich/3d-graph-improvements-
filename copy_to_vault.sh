#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
VAULT="${1:-${OBSIDIAN_VAULT:-$HOME/Desktop/Obsidian}}"
CHECK=0
# Only build/runtime inputs belong in runtime source identity. versions.json is
# Obsidian compatibility registry metadata and is not installed or executed.
RUNTIME_PATHS=(
  src
  manifest.json
  package.json
  package-lock.json
  styles.css
)

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

for command in git node npm sha256sum install; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command unavailable: %s\n' "$command" >&2
    exit 2
  }
done

REPO_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel)"
[[ "$(cd -- "$REPO_ROOT" && pwd -P)" == "$ROOT" ]] || {
  printf 'Repository root mismatch: %s\n' "$REPO_ROOT" >&2
  exit 2
}
git -C "$ROOT" diff --quiet -- "${RUNTIME_PATHS[@]}" || {
  echo "Tracked runtime source has unstaged changes; refusing unverifiable install." >&2
  exit 3
}
git -C "$ROOT" diff --cached --quiet -- "${RUNTIME_PATHS[@]}" || {
  echo "Tracked runtime source has staged changes; refusing unverifiable install." >&2
  exit 3
}
RUNTIME_SOURCE_SHA="$(git -C "$ROOT" log -1 --format=%H -- "${RUNTIME_PATHS[@]}")"
[[ "$RUNTIME_SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Could not resolve runtime source commit." >&2
  exit 3
}

for path in "$ROOT/manifest.json" "$ROOT/styles.css"; do
  [[ -f "$path" && ! -L "$path" ]] || {
    printf 'Required plugin source file unavailable: %s\n' "$path" >&2
    exit 2
  }
done

if (( ! CHECK )); then
  npm --prefix "$ROOT" run build
fi
[[ -f "$ROOT/main.js" && ! -L "$ROOT/main.js" ]] || {
  printf 'Required built plugin file unavailable: %s\n' "$ROOT/main.js" >&2
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
BUILD_MAIN_SHA="$(sha256sum "$ROOT/main.js" | awk '{print $1}')"
BUILD_MANIFEST_SHA="$(sha256sum "$ROOT/manifest.json" | awk '{print $1}')"
BUILD_STYLES_SHA="$(sha256sum "$ROOT/styles.css" | awk '{print $1}')"

if (( CHECK )); then
  printf 'PLUGIN_INSTALL_CHECK=PASS id=%s version=%s runtime_source_sha=%s main_sha256=%s target=%s\n' \
    "$PLUGIN_ID" "$VERSION" "$RUNTIME_SOURCE_SHA" "$BUILD_MAIN_SHA" "$TARGET"
  exit 0
fi

mkdir -p -- "$TARGET" "$BACKUP_ROOT"
if [[ -f "$TARGET/main.js" || -f "$TARGET/manifest.json" || -f "$TARGET/styles.css" ]]; then
  BACKUP="$BACKUP_ROOT/$STAMP"
  mkdir -p -- "$BACKUP"
  for name in main.js manifest.json styles.css .intelligence-graph-install.json; do
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

INSTALLED_MAIN_SHA="$(sha256sum "$TARGET/main.js" | awk '{print $1}')"
INSTALLED_MANIFEST_SHA="$(sha256sum "$TARGET/manifest.json" | awk '{print $1}')"
INSTALLED_STYLES_SHA="$(sha256sum "$TARGET/styles.css" | awk '{print $1}')"
[[ "$INSTALLED_MAIN_SHA" == "$BUILD_MAIN_SHA" ]]
[[ "$INSTALLED_MANIFEST_SHA" == "$BUILD_MANIFEST_SHA" ]]
[[ "$INSTALLED_STYLES_SHA" == "$BUILD_STYLES_SHA" ]]
INSTALLED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node - \
  "$PLUGIN_ID" \
  "$VERSION" \
  "$RUNTIME_SOURCE_SHA" \
  "$INSTALLED_MAIN_SHA" \
  "$INSTALLED_MANIFEST_SHA" \
  "$INSTALLED_STYLES_SHA" \
  "$INSTALLED_AT" > "$TARGET/.intelligence-graph-install.json" <<'NODE'
const [id, version, runtimeSourceSha, mainSha256, manifestSha256, stylesSha256, installedAt] = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  schema_version: "2026-08-26.intelligence-graph-install.v1",
  id,
  version,
  runtime_source_sha: runtimeSourceSha,
  main_sha256: mainSha256,
  manifest_sha256: manifestSha256,
  styles_sha256: stylesSha256,
  installed_at: installedAt,
  tracked_runtime_source_clean: true
}, null, 2) + "\n");
NODE
printf '%s\n' "$VERSION" > "$TARGET/.intelligence-graph-version"
touch "$TARGET/.hotreload"

printf 'PLUGIN_INSTALL_STATUS=PASS id=%s version=%s runtime_source_sha=%s main_sha256=%s target=%s\n' \
  "$PLUGIN_ID" "$VERSION" "$RUNTIME_SOURCE_SHA" "$INSTALLED_MAIN_SHA" "$TARGET"
