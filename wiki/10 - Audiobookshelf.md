# 10 - Audiobookshelf

Audiobookshelf is the experimental audiobook and podcast service in this guide.

Treat it as the advanced audio service: useful, but more fragile on native
Termux than Jellyfin, Navidrome, Samba, or the dashboard.

## Before You Start

Read:

- [[06 - USB Media Storage]]
- [[05 - Service Supervision]]
- [[09 - Navidrome]]

The Navidrome page matters because separating music and audiobooks early saves a
lot of cleanup later.

## Library Folders

Recommended:

```text
/mnt/media_rw/<usb-volume-id>/Audiobooks
/mnt/media_rw/<usb-volume-id>/Podcasts
```

Audiobookshelf supports its own library setup in the web UI. Keep the physical
folders simple first.

## Native Termux Reality

Audiobookshelf is a Node application. Native builds on Android/Termux can work,
but they are more fragile than simple packages.

Expect possible trouble with:

- Node versions
- native modules
- Python/node-gyp compatibility
- Rust toolchain needs
- memory pressure during builds

> [!WARNING]
> Treat Audiobookshelf as an advanced service in this guide. Get SSH, storage,
> service supervision, dashboard, Jellyfin, and Navidrome stable first.

## Install

There is no clean one-command Termux package path for Audiobookshelf in this
guide. The working shape is a native Termux build promoted into an app directory
under `$HOME`.

Follow the full build procedure in [[10A - Audiobookshelf Native Build]]. It
covers the Android-specific dependency work: Node 24, `sqlite3`, Lightning CSS,
client generation, FFmpeg/ffprobe paths, and the localhost launch proof.

Return here after the build has been promoted to:

```text
$HOME/apps/audiobookshelf/current
```

## Run Under Runit

Use the sanitized service template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/audiobookshelf"
cp templates/services/audiobookshelf/run "$PREFIX/var/service/audiobookshelf/run"
chmod +x "$PREFIX/var/service/audiobookshelf/run"
```

Edit the template values if your build, Node path, LAN IP, or audiobook root is
different:

```text
$PREFIX/var/service/audiobookshelf/run
```

The service should:

- wait for `usb-media-ready`
- keep app config under `$HOME/.config/audiobookshelf`
- keep generated state out of the media folder
- bind to the phone LAN IP
- run in the foreground

Start it:

```sh
sv up "$PREFIX/var/service/audiobookshelf"
```

## Access

Example:

```text
http://android-media.local:13378/audiobookshelf/
```

If you choose a different port or base path, document it in
[[13 - Dashboard on Port 8080]] and [[14 - Daily Operations]].

## Scanner Performance

The scanner is the weak point on a non-rooted Note 20.

The web UI can be fine. Small item API checks can be fine. The heavy scan path
is different: Audiobookshelf walks the library, stats files, probes audio,
extracts metadata, writes its SQLite state, and may involve FFmpeg/ffprobe work.
On this phone, that can consume enough CPU and I/O to make the whole media box
feel worse while the scan is running.

The validation result was mixed:

| Check | Result |
|---|---|
| Web UI | worked |
| Health endpoint | returned `200` |
| One M4B item | indexed and readable through the API |
| One multi-file MP3 book | indexed and readable through the API |
| Source media fingerprints | unchanged |
| Full scan completion marker | not proven |
| `libraries.lastScan` | stayed `null` after interrupted scans |

The practical setup is:

- keep the file watcher disabled
- keep automatic scan cron disabled
- run manual scans only when the phone is otherwise quiet
- avoid scanning while Jellyfin is transcoding or generating images
- watch the dashboard and supervisor state during the scan
- stop the scan if SSH, dashboard, Jellyfin, or Samba start feeling unstable

This is also why Audiobookshelf should be the last media service you add. Get
Jellyfin, Navidrome, Samba, the file portal, dashboard, and watchdog stable
first. Then add Audiobookshelf and treat each scan as a maintenance task, not
background noise.

A rooted Android device might offer better control over process priority,
storage mounts, cgroups, or background limits. That path is outside this guide
and was not tested here.

If a scan makes the phone sluggish, use
[[Troubleshooting#audiobookshelf-scan-makes-the-phone-slow]].

## Upstream Docs

If you need Audiobookshelf's own app reference, use [[Upstream Links]]. For the
Note 20 build path, keep going here.

## Troubleshooting

If the build fails, go to [[Troubleshooting#audiobookshelf-build-fails]].

If scans hurt the rest of the server, go to
[[Troubleshooting#audiobookshelf-scan-makes-the-phone-slow]].

If the app runs but cannot see books, go to [[Troubleshooting#usb-drive-missing]]
and then return here.

## Next

Set up file access: [[11 - Samba File Sharing]].
