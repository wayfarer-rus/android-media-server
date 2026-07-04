# Troubleshooting

This is the repair bench. When a service page says "jump to troubleshooting",
it should land near the thing you are actually seeing.

The rule of thumb is simple: check the shared foundations before blaming the
app. SSH, runit, USB storage, LAN IP, and mDNS can make several services look
broken at once.

## Quick Triage

Run this first:

```sh
date
ip -4 addr show wlan0
pgrep -af runsvdir
"$HOME/bin/usb-media-ready" && echo "USB ready"
sv status "$PREFIX/var/service/n20-home-dashboard"
```

Then open:

```text
http://android-media.local:8080/
```

If the dashboard is down too, stay on this page. If only one app is down, jump
to that app's section.

## Dashboard Shows A Service Down

First check whether runit thinks the service is up:

```sh
sv status "$PREFIX/var/service/<service-name>"
```

Then check whether the service is reachable from the phone:

```sh
curl -I http://127.0.0.1:8080/
```

Use the service's actual port:

| Service | Local check |
|---|---|
| Dashboard | `curl -I http://127.0.0.1:8080/` |
| Jellyfin | `curl -I http://127.0.0.1:8096/` |
| Navidrome | `curl -I http://127.0.0.1:4533/app/` |
| File portal | `curl -I http://127.0.0.1:8088/` |
| Samba | `timeout 3 sh -c '</dev/tcp/127.0.0.1/1445'` |
| SSH | `timeout 3 sh -c '</dev/tcp/127.0.0.1/8022'` |

If several USB-backed services are down, go to [[Troubleshooting#usb-drive-missing]].

If only the dashboard is wrong but local checks pass, check
`N20_DASHBOARD_PROBE_HOST` in [[13 - Dashboard on Port 8080]].

## SSH Unreachable

Symptoms:

- laptop cannot connect to `ssh -p 8022`
- dashboard may still be up
- media services may still be running

From the phone screen, open Termux and run:

```sh
sv status "$PREFIX/var/service/sshd" 2>/dev/null || true
pgrep -af sshd
timeout 3 sh -c '</dev/tcp/127.0.0.1/8022' && echo "local ssh open"
```

If `sshd` is not supervised yet, install [[04B - SSH Runit Service]]. For a
temporary rescue listener from the phone screen:

```sh
LAN_IP="192.168.1.50"
sshd -p 8022 -o "ListenAddress=$LAN_IP"
```

Then retry from the laptop:

```sh
ssh -p 8022 <termux-user>@192.168.1.50
```

If local SSH is open but the laptop cannot connect:

- confirm the phone's IP did not change
- confirm both devices are on the same LAN
- try the direct IP before trying `android-media.local`
- check whether Android has restricted Termux background use

> [!TIP]
> Once SSH is back, return to [[04B - SSH Runit Service]] and make sure SSH is
> managed by runit, not just a one-off shell command.

## Runit Split-Brain

Split-brain means service supervision is confused. You may have one current
`runsvdir` while old `runsv` children or old app processes are still alive.

Check:

```sh
pgrep -af "runsvdir"
ps -A -o pid,ppid,args | grep -E 'runsvdir|runsv ' | grep -v grep
```

Bad signs:

- more than one `runsvdir`
- old `runsv` processes with parent PID `1`
- stale app process still holding a port
- `sv status` disagrees with what ports are open

Recovery should go through your watchdog:

```sh
"$HOME/bin/runit-supervisor-watchdog" --status
"$HOME/bin/runit-supervisor-watchdog"
"$HOME/bin/gateway-services-check"
```

Keep recovery on the watchdog/checker path so there is only one service tree.
The full design is in [[15 - Watchdog and Recovery]].

## Service Will Not Start

Check the obvious pieces in this order:

```sh
ls -l "$PREFIX/var/service/<service>/run"
head -1 "$PREFIX/var/service/<service>/run"
sv status "$PREFIX/var/service/<service>"
```

The `run` file must be executable:

```sh
chmod +x "$PREFIX/var/service/<service>/run"
```

The first line should point at the Termux shell:

```sh
#!/data/data/com.termux/files/usr/bin/sh
```

If it is a USB-backed service:

```sh
"$HOME/bin/usb-media-ready"
```

If it binds to a LAN IP, confirm the phone still owns that IP:

```sh
ip -4 addr show wlan0
```

## Service Keeps Coming Back Or Going Down

The gateway checker may be doing exactly what you told it to do.

Examples:

- USB is missing, so the checker stops Jellyfin and Samba
- USB is present, so the checker restarts Jellyfin after you manually stop it
- dashboard is a core service, so the checker brings it back

For a controlled manual test:

1. stop the gateway watcher
2. test one service
3. start the gateway watcher again
4. run `gateway-services-check`

Start the watcher again when the manual test is done.

## USB Drive Missing

Symptoms:

- Jellyfin cannot see media
- Samba exits or shows no files
- file portal is empty
- Navidrome or Audiobookshelf scans fail
- dashboard shows several service failures

Check:

```sh
grep -E 'media_rw.*(sdfat|exfat)' /proc/mounts
ls -ld /mnt/media_rw/*
"$HOME/bin/usb-media-ready"
```

If the drive is absent:

1. unlock the phone
2. reseat the USB-C cable or hub
3. wait a few seconds
4. run the checks again
5. run `"$HOME/bin/gateway-services-check"`

If the path changed, update:

- `usb-media-ready`
- Samba config
- Jellyfin libraries
- Navidrome config
- Audiobookshelf libraries

Then return to [[06 - USB Media Storage]].

## mDNS Name Does Not Resolve

Try direct IP:

```text
http://192.168.1.50:8080/
```

If direct IP works, the service is alive and name resolution is the problem.

Check the mDNS service:

```sh
sv status "$PREFIX/var/service/mdns-android"
pgrep -af android-mdns-responder
```

From a laptop:

```sh
ping android-media.local
```

Common causes:

- phone IP changed
- mDNS service is not running
- client network blocks multicast
- Windows client does not handle this `.local` setup well

Use direct IP as a fallback and return to [[07 - Friendly LAN Name]].

## Jellyfin Fails Before The Web UI Opens

Symptoms:

- `sv status` shows Jellyfin repeatedly restarting
- `curl -I http://127.0.0.1:8096/` fails
- logs mention `.NET`, `hostfxr`, `coreclr`, missing libraries, or `ffmpeg`
- the web wizard never appears

Jellyfin on Termux is a compatibility install. Standard Linux builds assume a
glibc-based .NET environment; Termux uses Android's bionic libc. Start with the
runtime files that the service template expects:

```sh
command -v jellyfin
command -v ffmpeg
test -d "$PREFIX/lib/dotnet" && echo "dotnet runtime present"
test -d "$PREFIX/lib/jellyfin/jellyfin-web" && echo "jellyfin web present"
find "$PREFIX/lib/dotnet" \( -name 'libhostfxr.so' -o -name 'libcoreclr.so' \) -print
```

Check the runit template:

```sh
grep -E 'DOTNET_ROOT|DOTNET_BUNDLE_EXTRACT|JELLYFIN_WEB_DIR|--ffmpeg' \
  "$PREFIX/var/service/jellyfin/run"
```

Expected shape:

- `DOTNET_ROOT="$PREFIX/lib/dotnet"`
- `DOTNET_BUNDLE_EXTRACT_BASE_DIR` points under `$HOME/.cache`
- `JELLYFIN_WEB_DIR="$PREFIX/lib/jellyfin/jellyfin-web"`
- `--ffmpeg` points at an executable Termux `ffmpeg`

Then read the Jellyfin logs:

```sh
find "$HOME/.local/share/jellyfin/log" -maxdepth 1 -type f -print
tail -120 "$HOME/.local/share/jellyfin/log/"*.log 2>/dev/null
```

If the runtime files are missing, reinstall the Termux Jellyfin package path
rather than mixing in a generic Linux/glibc build:

```sh
pkg install jellyfin ffmpeg
```

Return to [[08 - Jellyfin]] after `curl -I http://127.0.0.1:8096/` returns.

## Jellyfin Restarts Or Scans Forever

First decide whether this is a service problem or a library problem.

Check service state:

```sh
sv status "$PREFIX/var/service/jellyfin"
curl -I http://127.0.0.1:8096/
```

Check USB:

```sh
"$HOME/bin/usb-media-ready"
```

If the web UI opens but a scan restarts Jellyfin, check for the .NET/Mono crash
seen in the Note 20 build:

```sh
grep -R "Cannot transition thread" "$HOME/.local/share/jellyfin/log" 2>/dev/null
```

The working mitigation was to reduce scan and image-processing fanout in:

```text
$HOME/.config/jellyfin/system.xml
```

Use these values:

```xml
<LibraryScanFanoutConcurrency>1</LibraryScanFanoutConcurrency>
<ParallelImageEncodingLimit>1</ParallelImageEncodingLimit>
```

If Jellyfin is up but scans are painful:

- add one library at a time
- avoid huge first scans while testing
- reduce heavy metadata/image work
- avoid real-time monitoring if it causes churn
- keep the phone charging and cool

If playback fails but the UI and scans work, focus on FFmpeg/transcoding next:

```sh
command -v ffmpeg
ffmpeg -version | head -1
grep -R -i "ffmpeg\\|transcod" "$HOME/.local/share/jellyfin/log" 2>/dev/null | tail -80
```

If the service restarts while scanning, look for the .NET crash, memory pressure,
and stale processes before changing library paths.

Return to [[08 - Jellyfin]].

## Jellyfin Playback Stutters Or Fails

First check whether Jellyfin is direct playing, remuxing, or transcoding. In the
Jellyfin playback stats panel, look for `Direct Play`, `Direct Stream`, or
`Transcoding`.

On the phone, check active FFmpeg work:

```sh
pgrep -af "ffmpeg|jellyfin-ffmpeg"
grep -R -i "transcod\\|ffmpeg\\|subtitle" "$HOME/.local/share/jellyfin/log" 2>/dev/null | tail -120
tail -80 "$HOME/.local/state/android-media-server/jellyfin-ffmpeg-wrapper.log" 2>/dev/null
```

Use the file itself as evidence:

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,pix_fmt,bits_per_raw_sample,width,height \
  -of default=noprint_wrappers=1:nokey=0 \
  "/mnt/media_rw/<usb-volume-id>/Shows/example.mkv"
```

| Symptom | Likely cause | Working fix |
|---|---|---|
| 4K starts transcoding and stutters | client cannot direct-decode the file or Jellyfin chose a transcode path | use a client that direct plays it, or use the FFmpeg wrapper from [[08 - Jellyfin#ffmpeg-wrapper]] |
| 4K HDR triggers tone mapping | the client asked the phone to convert HDR/video | use direct play or make an SDR/client-friendly copy offline |
| 10-bit H.264 fails on a TV client | High 10 / `yuv420p10le` is not a safe HLS copy path | convert offline to 8-bit H.264 `yuv420p` |
| subtitles make playback lag | ASS rendering or subtitle burn-in is too heavy | add a default `.srt` sidecar and select that track |
| old DVD folders import as one huge episode | Jellyfin is seeing a whole `VIDEO_TS` dump | split/remux into normal MKVs on a laptop |
| wrong title or series appears | stale or wrong local `.nfo` metadata | archive the bad `.nfo`, refresh, correct provider ID, then lock metadata |

For 10-bit H.264, the tested repair was offline conversion:

```sh
ffmpeg -i "input-high10.mkv" \
  -map 0 \
  -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 20 \
  -c:a aac -b:a 160k \
  -c:s copy \
  "output-8bit-h264.mkv"
```

Keep originals in `Shows-Originals` or `Movies-Originals`, outside the active
library. Refresh the item after replacing the active file.

Return to [[08 - Jellyfin#playback-tuning]].

## Navidrome Indexes Audiobooks

This usually means music and audiobooks are mixed together.

Best fix:

```text
Music/
Audiobooks/
```

Point Navidrome only at:

```text
/mnt/media_rw/<usb-volume-id>/Music
```

If you cannot move files yet, use Navidrome exclude rules where appropriate, but
folder separation is easier to explain and easier to keep working.

Return to [[09 - Navidrome]].

## Audiobookshelf Scan Makes The Phone Slow

Symptoms:

- dashboard becomes sluggish during a scan
- Jellyfin, Samba, or Navidrome feel worse while Audiobookshelf scans
- `gateway-services-check` or the watchdog reports recovery during the scan
- Audiobookshelf starts scanning but `libraries.lastScan` remains `null`

First check whether the phone is already busy:

```sh
"$HOME/bin/runit-supervisor-watchdog" --status
"$HOME/bin/gateway-services-check"
ps -A -o pid,ppid,%cpu,%mem,rss,args | grep -E 'audiobookshelf|node|ffmpeg|ffprobe|jellyfin|navidrome|smbd' | grep -v grep
```

For the first library pass:

- disable Audiobookshelf's watcher
- disable automatic scan cron
- scan only the `Audiobooks` folder, not the whole media drive
- keep Podcasts out until books are stable
- run scans when Jellyfin is idle
- keep the phone charging and cool

If the scan makes other services unreliable, stop Audiobookshelf and let the
server settle:

```sh
sv down "$PREFIX/var/service/audiobookshelf"
"$HOME/bin/runit-supervisor-watchdog"
"$HOME/bin/gateway-services-check"
```

Then start it again later and scan a smaller folder.

The safe expectation on a non-rooted Note 20 is modest: Audiobookshelf can be
useful, but large scans are maintenance work. Leave Navidrome and Jellyfin as
the calmer daily services.

Return to [[10 - Audiobookshelf#scanner-performance]].

## Audiobookshelf Build Fails

Audiobookshelf is the hardest service in this guide. Use
[[10A - Audiobookshelf Native Build]] as the main procedure and match the
failure to the step that produced it.

Common failure areas:

- Node version mismatch
- `node-gyp`
- Python compatibility
- native SQLite module build
- Lightning CSS native binding
- missing compiler tools
- Rust dependency
- memory pressure
- FFmpeg/ffprobe binary checks

Basic checks:

```sh
NODE="$HOME/apps/audiobookshelf/nodejs-lts-24.14.1/data/data/com.termux/files/usr/bin/node"
"$NODE" --version
npm --version
python --version
rustc --version 2>/dev/null || true
ffmpeg -version | head -1
ffprobe -version | head -1
```

Failure map:

| Symptom | Check | Fix |
|---|---|---|
| root `npm ci` complains about `fsevents` | root dependency step | use `npm install --ignore-scripts` as shown in [[10A - Audiobookshelf Native Build#install-server-dependencies]] |
| `ModuleNotFoundError: distutils` | `sqlite3` build log | build `sqlite3` by invoking npm bundled `node-gyp` directly |
| `node_sqlite3.node` is missing | `find node_modules/sqlite3/build -name '*.node'` | rerun the system-SQLite build in [[10A - Audiobookshelf Native Build#build-sqlite3]] |
| `Cannot find module '../lightningcss.android-arm64.node'` | client build log | build Lightning CSS and copy the Android arm64 binding |
| Nuxt exits without a useful stack trace | client generation log | serialize Nuxt/Webpack/Terser workers and rerun the generate step |
| Audiobookshelf downloads Linux `ffmpeg` or `ffprobe` | launch log | set `SKIP_BINARIES_CHECK=1`, `FFMPEG_PATH`, and `FFPROBE_PATH` |
| `libnusqlite3` download fails | launch log | leave `NUSQLITE3_PATH` unset; the server can run without that optional binary |

Good build artifacts:

```sh
APP="$HOME/apps/audiobookshelf/current"
NODE="$HOME/apps/audiobookshelf/nodejs-lts-24.14.1/data/data/com.termux/files/usr/bin/node"

test -r "$APP/index.js"
test -r "$APP/client/dist/index.html"
find "$APP/node_modules/sqlite3/build" -name 'node_sqlite3.node' -print
cd "$APP" && "$NODE" -e 'require("sqlite3"); console.log("sqlite-ok")'
```

Build while the phone is charging and cool. Keep the workspace under internal
storage, not USB.

Return to [[10 - Audiobookshelf]].

## Samba Client Cannot Connect

Validate on the phone:

```sh
testparm -s "$HOME/samba/smb-media-drive.conf"
timeout 3 sh -c '</dev/tcp/127.0.0.1/1445' && echo "1445 open"
timeout 3 sh -c '</dev/tcp/127.0.0.1/445' || echo "445 closed"
```

If local port `1445` is closed, fix the service first.

If local port `1445` is open but a laptop cannot connect:

- use `smb://android-media.local:1445/media-drive`
- try direct IP: `smb://192.168.1.50:1445/media-drive`
- confirm the client supports custom SMB ports
- confirm the Samba user exists
- confirm the password was not saved incorrectly in the client credential store
- confirm the phone IP did not change

If auth works but writing fails, check that Samba is using the effective Termux
user that can write the USB drive.

Return to [[11 - Samba File Sharing]].

## File Portal Build Fails

Use the native Termux build path from [[12 - File Portal]].

| Symptom | Check | Fix |
|---|---|---|
| Generic Linux arm64 binary crashes with `SIGSYS` | `"$HOME/.local/bin/filebrowser-quantum" version` works, but server startup dies | Rebuild on Termux instead of using the Linux release binary |
| Browser opens but the UI is missing or returns a plain error | `test -r "$HOME/.local/src/filebrowser-quantum/backend/http/embed/index.html"` | Run `npm ci` and `npm run build` in `frontend/`, then rebuild the backend |
| Go build cannot find a compiler | `command -v aarch64-linux-android-clang` | `pkg install clang` and rebuild with `CGO_ENABLED=1` |
| Build is killed halfway through | `dmesg` is usually not available; the shell just disappears or exits | Charge the phone, keep it cool, build from internal storage, and rerun the same command |
| Version says `untracked` | `"$HOME/.local/bin/filebrowser-quantum" version` | Rebuild with the `-ldflags` from [[12 - File Portal]] |

Return to [[12 - File Portal]].

## File Portal Service Loops

Check runit:

```sh
sv status "$PREFIX/var/service/filebrowser-quantum"
```

Then run the preflight checks by hand:

```sh
test -x "$HOME/.local/bin/filebrowser-quantum"
test -r "$HOME/.config/filebrowser-quantum/config.yaml"
test -r "$HOME/.config/filebrowser-quantum/admin-password.txt"
"$HOME/bin/usb-media-ready" --quiet
```

If the service prints `mount_missing`, edit:

```sh
nano "$PREFIX/var/service/filebrowser-quantum/run"
```

Make sure `MOUNT` points at the real USB mount, for example:

```sh
MOUNT="${MOUNT:-/mnt/media_rw/<usb-volume-id>}"
```

Replace `<usb-volume-id>` with the actual folder name from
[[06 - USB Media Storage]].

Return to [[12 - File Portal]].

## File Portal Is Empty

Check USB first:

```sh
"$HOME/bin/usb-media-ready"
```

Then check whether the portal service points at the real USB path, not a stale
or empty directory.

Also check the config:

```sh
grep -n 'path:' "$HOME/.config/filebrowser-quantum/config.yaml"
grep -n 'name:' "$HOME/.config/filebrowser-quantum/config.yaml"
```

If uploads fail but downloads work, check write permissions on the USB drive and
the portal's configured user.

Return to [[12 - File Portal]].

## TermuxAPI Hangs Or Returns No Data

The media server should still work.

Termux:API is optional in this guide. The dashboard may use it for battery or
Wi-Fi details, but service health should not depend on it.

If API commands hang:

```sh
timeout 5 termux-battery-status
timeout 5 termux-wifi-connectioninfo
```

If they still hang:

- leave Termux:API fields blank
- keep the dashboard timeouts short
- keep service health checks independent from Termux:API

Return to [[13 - Dashboard on Port 8080]].

## Port Already In Use

Find the process:

```sh
ss -ltnp 2>/dev/null | grep ':8080'
pgrep -af n20-dashboard
```

If a stale copy is holding the port, stop the service first:

```sh
sv down "$PREFIX/var/service/n20-home-dashboard"
```

Then kill only the stale matching process. Leave unrelated Python or Node
processes alone.

Restart:

```sh
sv up "$PREFIX/var/service/n20-home-dashboard"
```

## When In Doubt

Fall back to foundations:

1. phone has the expected LAN IP
2. SSH works
3. runit has one supervisor tree
4. USB readiness passes
5. dashboard is up
6. one media service at a time
