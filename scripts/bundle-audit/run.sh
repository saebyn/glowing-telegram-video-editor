#!/usr/bin/env bash
# Usage: bash scripts/bundle-audit/run.sh <repository with npm ci already run> <commit>
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "${1:?usage: bash run.sh REPO REV}" rev-parse --show-toplevel)
revision=$(git -C "$repo" rev-parse --verify "${2:?usage: bash run.sh REPO REV}^{commit}")
run=$(mktemp -d "${TMPDIR:-/tmp}/video-editor-bundle-audit.XXXXXXXX")
run=$(cd -- "$run" && pwd -P)
printf 'Run dir: %s\n' "$run"
# Like the release job: Vite's build mode is production by default; the separate
# PostCSS CLI command uses its own default when NODE_ENV is unset.
unset NODE_ENV
export npm_config_cache="$run/npm-cache" npm_config_offline=true

git -C "$repo" show "$revision:package-lock.json" > "$run/package-lock.json"
cmp "$run/package-lock.json" "$repo/package-lock.json" || {
  printf '%s\n' 'Commit and installed checkout must use the same lockfile.' >&2
  exit 1
}
{
  printf 'revision=%s\n' "$revision"
  node --version
  npm --version
  gzip --version | sed -n '1p'
  node -p '"lock SHA-256: " + require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex")' "$run/package-lock.json"
} | tee "$run/environment.txt"

pack_variant() {
  local variant=$1 snapshot=$2 filename package
  (cd "$snapshot" && npm pack --ignore-scripts --json --pack-destination "$run") > "$run/$variant-pack.json"
  filename=$(node -p "require(process.argv[1])[0].filename" "$run/$variant-pack.json")
  package="$run/consumer-$variant/node_modules/@saebyn/glowing-telegram-video-editor"
  mkdir -p "$package"
  tar --strip-components=1 -xf "$run/$filename" -C "$package"
  mv "$run/$filename" "$run/$variant.tgz"
}

for variant in baseline hls-light; do
  src="$run/$variant"
  mkdir "$src"
  git -C "$repo" archive "$revision" | tar -xf - -C "$src"
  # Real node_modules in each snapshot keeps generated PostCSS asset paths
  # identical to a normal checkout. It also isolates Vite's config/cache writes.
  cp -a "$repo/node_modules" "$src/node_modules"
  if [[ $variant == hls-light ]]; then
    node "$script_dir/prepare.mjs" hls-light "$src"
  fi
  (cd "$src" && npm run build) 2>&1 | tee "$run/$variant-build.log"
  pack_variant "$variant" "$src"
done

# Repack the already-built baseline plus one independent compiler build.
node "$script_dir/prepare.mjs" compiler-subpath "$run/baseline" "$run/baseline/.compiler-out" \
  2>&1 | tee "$run/compiler-subpath-build.log"
pack_variant compiler-subpath "$run/baseline"

# Vite and React peers for the separate tarball-consuming apps.
ln -s baseline/node_modules "$run/node_modules"
node "$script_dir/measure.mjs" "$run" 2>&1 | tee "$run/measure.log"
printf 'JSON report: %s/report.json\n' "$run"
