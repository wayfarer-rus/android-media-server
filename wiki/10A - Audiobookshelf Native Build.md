# 10A - Audiobookshelf Native Build

This page builds Audiobookshelf natively inside Termux on the Samsung Note 20.

Audiobookshelf has no simple Termux package path here. The working build uses an
isolated Node 24 runtime, a manually built `sqlite3` native module, a locally
built Android arm64 Lightning CSS binding, and explicit Termux `ffmpeg` and
`ffprobe` paths.

## Result

At the end, the phone should have:

```text
$HOME/apps/audiobookshelf/current
$HOME/apps/audiobookshelf/nodejs-lts-24.14.1/
$HOME/.config/audiobookshelf/
$HOME/.local/share/audiobookshelf/
$HOME/.cache/audiobookshelf/
```

The promoted app must pass:

```sh
NODE="$HOME/apps/audiobookshelf/nodejs-lts-24.14.1/data/data/com.termux/files/usr/bin/node"
APP="$HOME/apps/audiobookshelf/current"

cd "$APP"
"$NODE" -e 'require("sqlite3"); console.log("sqlite-ok")'
test -r "$APP/client/dist/index.html" && echo "client-ok"
```

## Build Rules

Keep the build on internal storage. The build workspace can grow past `1.5G`
while Rust and Nuxt are working.

Use this page from an SSH session. Keep the phone charging and cool. If the
screen is locked aggressively or Android kills the build, repeat the failed step
after the phone has cooled down.

The examples use:

| Value | Example |
|---|---|
| Audiobookshelf version | `v2.35.1` |
| Release directory | `$HOME/apps/audiobookshelf/releases/v2.35.1-aacdcc47` |
| LAN IP | `192.168.1.50` |
| URL | `http://android-media.local:13378/audiobookshelf/` |

## Install Build Tools

Install the packages used by the native build:

```sh
pkg update
pkg install git npm python clang make cmake pkg-config sqlite ffmpeg rust rust-std-aarch64-linux-android bash coreutils util-linux ripgrep
```

Check the tools:

```sh
command -v git
command -v npm
command -v python3
command -v clang
command -v make
command -v pkg-config
command -v ffmpeg
command -v ffprobe
command -v rustc
command -v cargo
```

`ffprobe` must resolve to a real executable. If `command -v ffprobe` prints
nothing, fix that before launching Audiobookshelf.

## Create A Workspace

Use one workspace for the whole build:

```sh
export ABS_VERSION="v2.35.1"
export ABS_SHORT_REV="aacdcc47"
export WS="$HOME/tmp/abs-build-$ABS_VERSION"

mkdir -p "$WS/logs"
cd "$WS"
```

## Extract Node 24 LTS

The build uses Node 24 LTS from the Termux `nodejs-lts` package contents. This
keeps the Audiobookshelf runtime separate from whatever `nodejs` package is
already installed.

```sh
cd "$WS"
apt-get download nodejs-lts
deb="$(ls -1 nodejs-lts_*_aarch64.deb | tail -1)"
dpkg-deb -x "$deb" nodejs-lts-root

export NODE24="$WS/nodejs-lts-root/data/data/com.termux/files/usr/bin/node"
export NODE24PREFIX="$WS/nodejs-lts-root/data/data/com.termux/files/usr"
export NPMCLI="$PREFIX/lib/node_modules/npm/bin/npm-cli.js"
export NPM_GYP="$PREFIX/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js"

"$NODE24" --version
"$NODE24" "$NPMCLI" --version
"$NODE24" "$NPM_GYP" --version
```

Expected shape:

```text
node: v24.x
npm: 11.x
node-gyp: 12.x
```

The important part is `node-gyp` 12 or newer. The `sqlite3` dependency can call
an older `node-gyp` from its own dependency tree, which fails with modern Termux
Python. This guide bypasses that path.

## Clone Audiobookshelf

```sh
cd "$WS"
git clone --depth 1 --branch "$ABS_VERSION" https://github.com/advplyr/audiobookshelf.git audiobookshelf
cd "$WS/audiobookshelf"
git rev-parse --short HEAD
```

The tested revision was:

```text
aacdcc47
```

## Install Server Dependencies

Install root dependencies with package scripts disabled:

```sh
cd "$WS/audiobookshelf"

PATH="$NODE24PREFIX/bin:$PATH" \
  npm_config_cache="$WS/npm-cache" \
  npm_config_audit=false \
  npm_config_fund=false \
  npm_config_update_notifier=false \
  timeout 900 \
  "$NODE24" "$NPMCLI" install --ignore-scripts
```

This avoids the `sqlite3` install script choosing the older dependency-tree
`node-gyp`. Npm may update the disposable `package-lock.json` by adding optional
platform metadata such as `fsevents`; that is expected in the build workspace.

## Build sqlite3

Audiobookshelf uses SQLite through the Node `sqlite3` native module. Android
arm64 has no matching upstream prebuilt module, so build it on the phone.

Use Termux system SQLite instead of compiling SQLite's bundled amalgamation:

```sh
cat > "$WS/build-sqlite-system.sh" <<'SH'
#!/data/data/com.termux/files/usr/bin/bash
set -u

WS="${WS:?set WS first}"
NODE24="$WS/nodejs-lts-root/data/data/com.termux/files/usr/bin/node"
NODE24PREFIX="$WS/nodejs-lts-root/data/data/com.termux/files/usr"
NPM_GYP="$PREFIX/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js"
PYTHON3="$(command -v python3)"
SQLITE_PREFIX="$PREFIX"
LOG="$WS/logs/sqlite3-system-libsqlite-node-gyp12.log"
STATUS="$WS/logs/sqlite3-system-libsqlite-node-gyp12.status"

cd "$WS/audiobookshelf/node_modules/sqlite3" || exit 97
rm -rf build

{
  printf "started=%s\n" "$(date -Iseconds)"
  "$NODE24" --version
  "$NODE24" "$NPM_GYP" --version
  "$PYTHON3" --version
  ls -lh "$SQLITE_PREFIX/include/sqlite3.h" "$SQLITE_PREFIX/lib"/libsqlite3.so* 2>/dev/null || true
  pkg-config --cflags --libs sqlite3 2>/dev/null || true

  PATH="$NODE24PREFIX/bin:$PATH" \
    PYTHON="$PYTHON3" \
    MAKEFLAGS=-j1 \
    UV_THREADPOOL_SIZE=1 \
    npm_config_jobs=1 \
    npm_config_nodedir="$NODE24PREFIX" \
    nice -n 19 ionice -c 3 timeout 900 \
    "$NODE24" "$NPM_GYP" rebuild --verbose \
    --nodedir="$NODE24PREFIX" \
    --sqlite="$SQLITE_PREFIX"

  rc=$?
  printf "finished=%s\n" "$(date -Iseconds)"
  printf "status=%s\n" "$rc"
  printf "%s\n" "$rc" > "$STATUS"
  exit "$rc"
} > "$LOG" 2>&1
SH

chmod +x "$WS/build-sqlite-system.sh"
WS="$WS" "$WS/build-sqlite-system.sh"
cat "$WS/logs/sqlite3-system-libsqlite-node-gyp12.status"
```

Expected status:

```text
0
```

Validate the module:

```sh
cd "$WS/audiobookshelf"

"$NODE24" - <<'NODE'
const sqlite3 = require("sqlite3");
console.log("sqlite3.VERSION=" + sqlite3.VERSION);
const db = new sqlite3.Database(":memory:");
db.get("select 42 as answer", (err, row) => {
  if (err) throw err;
  console.log("query.answer=" + row.answer);
  db.close();
});
NODE
```

Expected output includes:

```text
query.answer=42
```

## Install Client Dependencies

```sh
cd "$WS/audiobookshelf/client"

PATH="$NODE24PREFIX/bin:$PATH" \
  npm_config_cache="$WS/npm-cache-client" \
  npm_config_audit=false \
  npm_config_fund=false \
  npm_config_update_notifier=false \
  timeout 1200 \
  "$NODE24" "$NPMCLI" ci
```

This can take a few minutes.

## Build Lightning CSS

The client build uses Lightning CSS through Tailwind/PostCSS. The published
Lightning CSS packages did not include an Android arm64 native binding for this
build, so build the binding locally.

```sh
cd "$WS"
git clone --depth 1 --branch v1.29.2 https://github.com/parcel-bundler/lightningcss.git lightningcss-src

mkdir -p "$WS/cargo-home" "$WS/lightningcss-target"

cd "$WS/lightningcss-src"
CARGO_HOME="$WS/cargo-home" \
CARGO_TARGET_DIR="$WS/lightningcss-target" \
CARGO_BUILD_JOBS=1 \
CARGO_INCREMENTAL=0 \
CARGO_TERM_COLOR=never \
RUSTFLAGS="-C debuginfo=0" \
nice -n 19 ionice -c 3 timeout 3600 cargo build -p lightningcss_node --jobs 1
```

Install the binding into the Audiobookshelf client dependency tree:

```sh
cp "$WS/lightningcss-target/debug/liblightningcss_node.so" \
  "$WS/audiobookshelf/client/node_modules/lightningcss/lightningcss.android-arm64.node"
```

Validate it:

```sh
cd "$WS/audiobookshelf/client"

"$NODE24" - <<'NODE'
const lightningcss = require("lightningcss");
const out = lightningcss.transform({
  filename: "probe.css",
  code: Buffer.from(".x { color: red; }")
});
console.log("lightningcss-ok bytes=" + out.code.length);
NODE
```

## Serialize The Client Build

Android may kill the Nuxt/Webpack build when it fans out too much. Edit:

```text
$WS/audiobookshelf/client/nuxt.config.js
```

In the exported `module.exports` object, make sure the `build` section contains:

```js
build: {
  parallel: false,
  terser: {
    parallel: false
  }
}
```

If the file already has a `build` section, merge those keys into it. Keep
production mode enabled.

Check the edit:

```sh
rg -n "parallel: false|terser" "$WS/audiobookshelf/client/nuxt.config.js"
```

## Generate The Client

```sh
cat > "$WS/client-generate-production.sh" <<'SH'
#!/data/data/com.termux/files/usr/bin/sh
set -u

WS="${WS:?set WS first}"
CLIENT="$WS/audiobookshelf/client"
NODE24="$WS/nodejs-lts-root/data/data/com.termux/files/usr/bin/node"
NPMCLI="$PREFIX/lib/node_modules/npm/bin/npm-cli.js"
LOG="$WS/logs/client-npm-run-generate-production.log"
STATUS="$WS/logs/client-npm-run-generate-production.status"
LOCKED=0

mkdir -p "$WS/logs"
rm -f "$STATUS"

export PATH="$WS/nodejs-lts-root/data/data/com.termux/files/usr/bin:$PATH"
export npm_config_cache="$WS/npm-cache-client"
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false
export UV_THREADPOOL_SIZE=1
export MAKEFLAGS="-j1"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
export CI=1

cleanup() {
  if [ "$LOCKED" = "1" ] && command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM HUP

cd "$CLIENT" || exit 1
rm -rf .nuxt dist

{
  date
  "$NODE24" --version
  "$NODE24" "$NPMCLI" --version
  "$NODE24" -e 'require("lightningcss"); console.log("lightningcss-ok")'
  if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock >/dev/null 2>&1 && LOCKED=1
  fi
  nice -n 19 ionice -c 3 timeout 1800 "$NODE24" "$NPMCLI" run generate
  rc=$?
  printf "%s\n" "$rc" > "$STATUS"
  exit "$rc"
} > "$LOG" 2>&1
SH

chmod +x "$WS/client-generate-production.sh"
WS="$WS" "$WS/client-generate-production.sh"
cat "$WS/logs/client-npm-run-generate-production.status"
```

Expected status:

```text
0
```

Check the generated client:

```sh
test -r "$WS/audiobookshelf/client/dist/index.html" && echo "client-ok"
find "$WS/audiobookshelf/client/dist" -type f | wc -l
```

## Localhost Launch Test

Run an empty local instance before promoting the build. This proves `sqlite3`,
the generated client, and the runtime flags work without touching the real
audiobook library.

```sh
cd "$WS/audiobookshelf"
mkdir -p "$WS/runtime/config" "$WS/runtime/metadata" "$WS/runtime/cache"

HOST=127.0.0.1 \
PORT=18434 \
CONFIG_PATH="$WS/runtime/config" \
METADATA_PATH="$WS/runtime/metadata" \
CACHE_PATH="$WS/runtime/cache" \
FFMPEG_PATH="$(command -v ffmpeg)" \
FFPROBE_PATH="$(command -v ffprobe)" \
SKIP_BINARIES_CHECK=1 \
SOURCE=local \
ROUTER_BASE_PATH=/audiobookshelf \
NODE_OPTIONS=--max-old-space-size=768 \
"$NODE24" index.js --host 127.0.0.1 --port 18434 \
  --config "$WS/runtime/config" \
  --metadata "$WS/runtime/metadata" \
  --source local \
  > "$WS/logs/server-localhost.log" 2>&1 &

echo $! > "$WS/logs/server-localhost.pid"
sleep 10
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18434/audiobookshelf/
kill -INT "$(cat "$WS/logs/server-localhost.pid")"
```

Expected HTTP code:

```text
200
```

Logs should include:

```text
Listening on http://127.0.0.1:18434
Db connection was successful
```

## Promote The Build

After the localhost proof passes, promote the build:

```sh
release="$HOME/apps/audiobookshelf/releases/$ABS_VERSION-$ABS_SHORT_REV"
runtime="$HOME/apps/audiobookshelf/nodejs-lts-24.14.1"

mkdir -p "$HOME/apps/audiobookshelf/releases"
rm -rf "$release" "$runtime"

cp -a "$WS/audiobookshelf" "$release"
cp -a "$WS/nodejs-lts-root" "$runtime"
ln -sfn "$release" "$HOME/apps/audiobookshelf/current"
```

Verify the promoted build:

```sh
NODE="$HOME/apps/audiobookshelf/nodejs-lts-24.14.1/data/data/com.termux/files/usr/bin/node"
APP="$HOME/apps/audiobookshelf/current"

cd "$APP"
"$NODE" -e 'require("sqlite3"); console.log("sqlite-ok")'
test -r "$APP/client/dist/index.html" && echo "client-ok"
```

## Enable The Service

Return to [[10 - Audiobookshelf#run-under-runit]] and install the runit service
template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/audiobookshelf"
cp templates/services/audiobookshelf/run "$PREFIX/var/service/audiobookshelf/run"
chmod +x "$PREFIX/var/service/audiobookshelf/run"
nano "$PREFIX/var/service/audiobookshelf/run"
```

Set at least:

```sh
AUDIOBOOKS="/mnt/media_rw/<usb-volume-id>/Audiobooks"
HOST_ADDR="192.168.1.50"
```

Then start it:

```sh
sv up "$PREFIX/var/service/audiobookshelf"
sv status "$PREFIX/var/service/audiobookshelf"
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.1.50:13378/audiobookshelf/healthcheck
```

Expected HTTP code:

```text
200
```

## First Library

In the Audiobookshelf web UI, create one library:

| Field | Value |
|---|---|
| Name | `Audiobooks` |
| Media type | `book` |
| Folder | `/mnt/media_rw/<usb-volume-id>/Audiobooks` |

Keep watcher and automatic scan disabled for the first pass. Run one manual scan
after [[05 - Service Supervision]] is stable, and read
[[10 - Audiobookshelf#scanner-performance]] before pointing it at a large
library.

## Build Failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm ci` fails with missing `fsevents` | root lockfile is strict under current npm | use root `npm install --ignore-scripts` |
| `ModuleNotFoundError: distutils` | `sqlite3` used old `node-gyp` | build `sqlite3` with npm bundled `node-gyp` 12 |
| `sqlite3.c` compile disappears | phone killed the heavy compile | use system SQLite, `MAKEFLAGS=-j1`, `nice`, `ionice`, phone charging and cool |
| `Cannot find module '../lightningcss.android-arm64.node'` | no Android arm64 Lightning CSS prebuild | build Lightning CSS from source and copy the `.so` as `lightningcss.android-arm64.node` |
| Nuxt build exits without a useful error | worker fanout is too high for the phone | serialize `build.parallel` and `terser.parallel`, then rerun generate |
| bundled `ffmpeg` or `ffprobe` fails with `SIGSYS` | Linux binary downloaded by Audiobookshelf is not usable on Android | set `SKIP_BINARIES_CHECK=1`, `FFMPEG_PATH`, and `FFPROBE_PATH` |
| `libnusqlite3` download fails | Android arm64 is not supported for that optional binary | leave `NUSQLITE3_PATH` unset |

For the longer repair path, see [[Troubleshooting#audiobookshelf-build-fails]].

## Cleanup

After the promoted build is working, the build workspace is disposable:

```sh
rm -rf "$WS"
```

Rust is only needed for future Lightning CSS rebuilds. Keep it installed if you
expect to rebuild Audiobookshelf updates on the phone.
