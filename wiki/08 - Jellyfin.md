# 08 - Jellyfin

Jellyfin handles movies and shows.

In this setup, Jellyfin listens on HTTP port `8096`, stays on the LAN, and
starts only after USB storage is ready.

## Before You Start

Make sure these work:

- [[05 - Service Supervision]]
- [[06 - USB Media Storage]]
- [[07 - Friendly LAN Name]]

> [!NOTE]
> A missing USB drive can look like a Jellyfin library problem. Check storage
> first when several media services fail together.

## Install

Jellyfin is the least normal package in this guide. Upstream Jellyfin targets
standard Linux distributions with a glibc-based .NET runtime. Termux runs on
Android's bionic libc, so treat this as a compatibility install: install the
Termux package, verify the .NET/runtime pieces, then prove startup and scanning.

Install the Termux packages:

```sh
pkg install jellyfin ffmpeg
```

Check that the binaries exist:

```sh
command -v jellyfin
command -v ffmpeg
```

Check the runtime paths used by the service template:

```sh
test -d "$PREFIX/lib/dotnet" && echo "dotnet runtime present"
test -d "$PREFIX/lib/jellyfin/jellyfin-web" && echo "jellyfin web present"
find "$PREFIX/lib/dotnet" \( -name 'libhostfxr.so' -o -name 'libcoreclr.so' \) -print
```

The web UI is only the first proof. Native pieces used by .NET, SQLite/database
access, image processing, and FFmpeg/transcoding can still fail later. The real
test is: service starts, the wizard opens, a small library scans, and playback
works from a LAN client.

If Jellyfin fails before the web UI opens, use
[[Troubleshooting#jellyfin-fails-before-the-web-ui-opens]].

## Media Folders

Recommended paths:

```text
/mnt/media_rw/<usb-volume-id>/Movies
/mnt/media_rw/<usb-volume-id>/Shows
```

Inside Jellyfin, create separate libraries:

- Movies -> `Movies`
- Shows -> `Shows`

Keep names plain during the first setup. Library polish can wait.

## Run Under Runit

Use the sanitized service template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/jellyfin"
cp templates/services/jellyfin/run "$PREFIX/var/service/jellyfin/run"
chmod +x "$PREFIX/var/service/jellyfin/run"
```

The service lives at:

```text
$PREFIX/var/service/jellyfin/run
```

The `run` script should:

- wait for `usb-media-ready`
- set `DOTNET_ROOT` to `$PREFIX/lib/dotnet`
- set `DOTNET_BUNDLE_EXTRACT_BASE_DIR` under `$HOME/.cache`
- point `JELLYFIN_WEB_DIR` at `$PREFIX/lib/jellyfin/jellyfin-web`
- pass an explicit `--ffmpeg` path
- start Jellyfin in the foreground
- avoid backgrounding itself

Start it:

```sh
sv up "$PREFIX/var/service/jellyfin"
```

> [!TIP]
> If Jellyfin keeps restarting, check [[Troubleshooting#jellyfin-restarts-or-scans-forever]].

## Access

From the LAN:

```text
http://android-media.local:8096/
```

First setup happens in the web wizard. Create an admin account, add libraries,
and keep remote access disabled unless you are deliberately building VPN access.

## Scan Settings

On a phone, slow and steady wins. This also reduces pressure on the .NET runtime
and native libraries during the first real scan.

Recommended approach:

- add one library at a time
- let the first scan finish before adding another large library
- avoid frequent real-time monitoring if it causes churn
- keep image extraction and metadata work conservative

> [!TIP]
> If scans restart Jellyfin or make the whole phone unstable, use
> [[Troubleshooting#jellyfin-restarts-or-scans-forever]] before changing library
> structure.

## Stability Tuning

The first useful tuning is boring: reduce scan fanout and image work. A large
library scan can otherwise push the Android .NET runtime into a crash that looks
like a random Jellyfin restart.

Stop Jellyfin before editing:

```sh
sv down "$PREFIX/var/service/jellyfin"
cp "$HOME/.config/jellyfin/system.xml" \
  "$HOME/.config/jellyfin/system.xml.bak.$(date +%Y%m%d-%H%M%S)"
nano "$HOME/.config/jellyfin/system.xml"
```

Set or add these values under `<ServerConfiguration>`:

```xml
<LibraryScanFanoutConcurrency>1</LibraryScanFanoutConcurrency>
<ParallelImageEncodingLimit>1</ParallelImageEncodingLimit>
```

If trickplay image generation competes with scanning or playback, keep it small
or turn it off while the library is settling:

```xml
<TrickplayOptions>
  <ScanBehavior>NonBlocking</ScanBehavior>
  <ProcessThreads>1</ProcessThreads>
  <WidthResolutions>
    <int>320</int>
  </WidthResolutions>
</TrickplayOptions>
```

Start Jellyfin again:

```sh
sv up "$PREFIX/var/service/jellyfin"
```

The useful proof is not that the page opens. The proof is a full library scan
that completes without the Jellyfin PID changing:

```sh
pgrep -af "jellyfin --service"
grep -R "Scan Media Library Completed" "$HOME/.local/share/jellyfin/log" 2>/dev/null | tail
```

If scans still restart the server, go to
[[Troubleshooting#jellyfin-restarts-or-scans-forever]].

## Playback Tuning

The Note 20 can serve a lot of video, but it is still a phone. The working
strategy is:

| Media case | Working path |
|---|---|
| 4K H.264 or HEVC | direct play, direct stream, or HLS video copy |
| 4K that starts full transcoding | fix the client/format path instead of expecting live re-encode |
| 10-bit H.264 / High 10 | convert offline to 8-bit H.264 `yuv420p` |
| ASS subtitles on weak TV clients | keep the `.ass`, add a default `.srt` sidecar when possible |
| DVD `VIDEO_TS` folders and odd old rips | normalize on a laptop into regular episode/movie MKVs |
| bad local `.nfo` metadata | archive the bad `.nfo`, refresh, then lock corrected metadata |

Inspect problem files before changing Jellyfin settings:

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,pix_fmt,bits_per_raw_sample,width,height \
  -of default=noprint_wrappers=1:nokey=0 \
  "/mnt/media_rw/<usb-volume-id>/Shows/example.mkv"

ffprobe -v error -select_streams s \
  -show_entries stream=index,codec_name:stream_tags=language,title \
  -of default=noprint_wrappers=1:nokey=0 \
  "/mnt/media_rw/<usb-volume-id>/Shows/example.mkv"
```

### 4K Checklist

For 4K, start with the client, not the server. Open Jellyfin's playback stats
while the file is playing.

Good signs:

- `Direct Play`
- `Direct Stream`
- HLS with video copy
- no subtitle burn-in
- no tone mapping

Bad signs:

- `Transcoding (Video)`
- `libx264` re-encode of a 4K file
- subtitle burn-in
- HDR tone mapping on the phone
- `ffmpeg` using high CPU for the whole playback session

Keep the first pass simple in Jellyfin's playback/transcoding settings:

```xml
<HardwareAccelerationType>none</HardwareAccelerationType>
<EnableTonemapping>false</EnableTonemapping>
```

The Termux FFmpeg build exposes Android MediaCodec encoders, but H.264
MediaCodec encoding crashed in testing and software `libx264` was below real
time for difficult files. Treat the phone as a server and remuxer first. Use
offline conversion for files that need real video changes.

### FFmpeg Wrapper

The service template can use a small FFmpeg wrapper when it exists:

```text
$HOME/bin/jellyfin-ffmpeg-compat-wrapper
```

Install it:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/bin"
cp templates/bin/jellyfin-ffmpeg-compat-wrapper \
  "$HOME/bin/jellyfin-ffmpeg-compat-wrapper"
chmod +x "$HOME/bin/jellyfin-ffmpeg-compat-wrapper"
```

The wrapper passes normal FFmpeg work through to Termux `ffmpeg`. For HLS jobs
where Jellyfin tries to re-encode compatible H.264 or HEVC with `libx264`, it
can rewrite the job to copy the video stream instead. That helps with files
that the client can already decode but Jellyfin decided to package as HLS.

The wrapper refuses H.264 High 10 / `yuv420p10le` copy. That format caused
client playback failures in testing, and live H.264 re-encode on the phone was
below real time.

Check whether the wrapper is active:

```sh
grep -n 'JELLYFIN_FFMPEG\|--ffmpeg' "$PREFIX/var/service/jellyfin/run"
"$HOME/bin/jellyfin-ffmpeg-compat-wrapper" -version | head -1
```

Wrapper rewrites are logged here:

```sh
tail -80 "$HOME/.local/state/android-media-server/jellyfin-ffmpeg-wrapper.log"
```

If a client fails only when the wrapper is active, set `JELLYFIN_FFMPEG` back to
plain Termux FFmpeg in the service file:

```sh
JELLYFIN_FFMPEG="${JELLYFIN_FFMPEG:-$PREFIX/bin/ffmpeg}"
```

Then restart Jellyfin.

### 10-Bit H.264

10-bit H.264 is the awkward one. Some clients cannot direct-decode it, copying
it into HLS can still fail, and the phone is not fast enough for reliable
software re-encoding.

Use an offline conversion on a laptop or desktop:

```sh
ffmpeg -i "input-high10.mkv" \
  -map 0 \
  -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 20 \
  -c:a aac -b:a 160k \
  -c:s copy \
  "output-8bit-h264.mkv"
```

Keep the original outside the active Jellyfin library, for example:

```text
/mnt/media_rw/<usb-volume-id>/Shows-Originals/
```

Then put the converted file in `Shows`, refresh the item in Jellyfin, and test
the target client again.

### Subtitles

ASS subtitles can be expensive on TV clients because styling may force heavier
rendering or subtitle burn-in. Keep the original `.ass` sidecar, but add a
simple default `.srt` sidecar for the common language when possible:

```text
Show - S01E01.mkv
Show - S01E01.ass
Show - S01E01.default.en.srt
```

Validate that Jellyfin sees both tracks in the item details. If playback stutter
only happens with subtitles enabled, test with the `.srt` track first.

### Old Video And DVD Rips

Old DVD folder dumps, menu VOBs, AppleDouble `._*` files, and wrong local `.nfo`
files can make Jellyfin import nonsense: whole discs as one episode, impossible
durations, wrong series names, or duplicate items.

Clean these outside the phone:

1. copy or read the source from a laptop
2. identify real titles and chapters
3. create one normal MKV per movie or episode
4. preserve useful audio and subtitle tracks
5. stage the clean tree outside the active library
6. move the old folder to `Shows-Originals` or `Movies-Originals`
7. move the clean folder into the library
8. refresh the Jellyfin item

A typical HandBrakeCLI shape for old DVD material:

```sh
HandBrakeCLI -i "/path/to/VIDEO_TS" -t 1 -c 3 \
  -o "Show - S1940E03 - Episode Title.mkv" \
  -e x264 --encoder-preset veryfast -q 20 \
  -E av_aac -B 128 --all-audio \
  --all-subtitles --subtitle-burned=none --subtitle-default=none
```

Verify the output before moving it into the library:

```sh
ffprobe -v error -show_streams "Show - S1940E03 - Episode Title.mkv" | sed -n '1,80p'
```

If Jellyfin picked the wrong show or movie from old local metadata, remove or
archive the bad `.nfo`, refresh, correct the provider ID in the UI, and lock the
metadata after it is right.

## Clients

Use normal Jellyfin clients:

- browser
- Android TV app
- mobile app
- smart TV app if available

Automatic discovery varies by client. The manual URL is reliable:

```text
http://android-media.local:8096/
```

## Upstream Docs

If you need Jellyfin's own networking reference, use [[Upstream Links]]. For the
Note 20 build path, keep going here.

## Next

For music, set up [[09 - Navidrome]]. For file access, set up
[[11 - Samba File Sharing]].
