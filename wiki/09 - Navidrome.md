# 09 - Navidrome

Navidrome is the music server.

In this setup, Navidrome is the LAN-only music service on port `4533`. Keep it
pointed at music and let [[10 - Audiobookshelf]] handle spoken-word libraries.

## Before You Start

Make sure storage is stable:

- [[06 - USB Media Storage]]
- [[05 - Service Supervision]]

## Install

Install Navidrome from Termux:

```sh
pkg install navidrome
```

Check the binary:

```sh
command -v navidrome
```

## Music Folder

Use:

```text
/mnt/media_rw/<usb-volume-id>/Music
```

Keep audiobooks out of the music folder if possible. Navidrome is happiest when
it indexes music, not a mixed pile of music and long-form spoken audio.

> [!TIP]
> If your music folder already contains audiobooks, read
> [[Troubleshooting#navidrome-indexes-audiobooks]] before starting a huge scan.

## Config

The sanitized config template is:

```text
templates/configs/navidrome.toml
```

Important values:

```toml
Address = "192.168.1.50"
Port = "4533"
MusicFolder = "/mnt/media_rw/<usb-volume-id>/Music"
CacheFolder = "/data/data/com.termux/files/home/.cache/navidrome"
LogFile = "/data/data/com.termux/files/home/.local/state/navidrome/navidrome.log"
CoverArtPriority = "cover.*, folder.*, front.*, embedded, external"
```

Copy the template and edit it:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/.config/navidrome"
cp templates/configs/navidrome.toml "$HOME/.config/navidrome/navidrome.toml"
nano "$HOME/.config/navidrome/navidrome.toml"
```

If you use external artwork agents, keep secrets outside the checked-in config.
The service template sources this optional file when it exists:

```text
$HOME/.config/navidrome/navidrome.env
```

Example contents:

```sh
export ND_LASTFM_APIKEY="..."
export ND_LASTFM_SECRET="..."
```

Last.fm credentials are needed for Last.fm album-cover lookup. Without them,
Navidrome still uses local `cover.*`, `folder.*`, `front.*`, and embedded
artwork.

Use Navidrome's own log file first:

```sh
tail -120 "$HOME/.local/state/navidrome/navidrome.log"
```

Do not add a runit `log/run` service unless you are deliberately trading extra
processes for runit logging. See [[15 - Watchdog and Recovery#too-many-helper-processes]].

## Artwork and Metadata Cleanup

Navidrome does not rewrite music tags or rename media files. Clean the source
library, then run a full scan.

The helper script used for cautious cleanup is:

```text
templates/bin/navidrome-library-repair
```

Copy it to the phone and pass the real music root:

```sh
mkdir -p "$HOME/bin" "$HOME/media-maintenance/navidrome-library-repair"
cp templates/bin/navidrome-library-repair "$HOME/bin/navidrome-library-repair"
chmod 755 "$HOME/bin/navidrome-library-repair"

"$HOME/bin/navidrome-library-repair" \
  --music-root "/mnt/media_rw/<usb-volume-id>/Music" audit
```

The helper is designed to be conservative:

- dry-run is the default
- manifests are written under
  `$HOME/media-maintenance/navidrome-library-repair/`
- local folder images are copied to `cover.*` only when the source image and
  album folder match safely
- tag repair is limited to high-confidence mojibake
- filename repair is limited to obvious UTF-8 mojibake
- online cover fetching is bounded and skips weak folder/album matches

Typical order:

```sh
sv down "$PREFIX/var/service/navidrome"

"$HOME/bin/navidrome-library-repair" --music-root "/mnt/media_rw/<usb-volume-id>/Music" --apply local-covers
"$HOME/bin/navidrome-library-repair" --music-root "/mnt/media_rw/<usb-volume-id>/Music" --apply repair-tags
"$HOME/bin/navidrome-library-repair" --music-root "/mnt/media_rw/<usb-volume-id>/Music" --apply repair-filenames

rm -rf "$HOME/.cache/navidrome/images"
mkdir -p "$HOME/.cache/navidrome/images"
navidrome --configfile "$HOME/.config/navidrome/navidrome.toml" scan --full

sv up "$PREFIX/var/service/navidrome"
```

Run online cover fetching only as a slow, bounded pass. Public APIs can rate
limit aggressively, and weak matches can produce wrong album art:

```sh
"$HOME/bin/navidrome-library-repair" \
  --music-root "/mnt/media_rw/<usb-volume-id>/Music" \
  --online-sources musicbrainz,deezer \
  --musicbrainz-delay 1.2 \
  --max-online 25 \
  --max-albums 750 \
  online-covers
```

Inspect the manifest first. If the album, artist, source album, source artist,
and folder confidence all look right, apply the same bounded pass:

```sh
"$HOME/bin/navidrome-library-repair" \
  --music-root "/mnt/media_rw/<usb-volume-id>/Music" \
  --online-sources musicbrainz,deezer \
  --musicbrainz-delay 1.2 \
  --max-online 25 \
  --max-albums 750 \
  --apply online-covers
```

The helper uses MusicBrainz/Cover Art Archive and Deezer before the iTunes
fallback. Keep `--max-online` low and rerun in batches instead of doing one
large unattended pass. After applying covers, scan the changed folders with
`navidrome scan --target-file ...` or run a full scan during a maintenance
window.

Some libraries have broken album grouping: a compilation or classical folder can
appear as dozens of separate albums because each track has a different album or
album-artist tag. In that case, search for one cover for the physical folder:

```sh
"$HOME/bin/navidrome-library-repair" \
  --music-root "/mnt/media_rw/<usb-volume-id>/Music" \
  --online-sources musicbrainz,deezer,itunes \
  --itunes-countries US,DE,GB \
  --max-online 25 \
  --max-albums 120 \
  folder-online-covers
```

Inspect the manifest before applying. The folder-cover mode skips artist-only
folders unless there is stronger album evidence, because those folders often
contain loose tracks from several releases.

The audit output separates local artwork from external or embedded artwork.
`albums_without_any_art_source` is the strict count to watch when measuring
albums that still have no usable cover source.

## Run Under Runit

Use the sanitized service template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/navidrome"
cp templates/services/navidrome/run "$PREFIX/var/service/navidrome/run"
chmod +x "$PREFIX/var/service/navidrome/run"
```

The service lives at:

```text
$PREFIX/var/service/navidrome/run
```

The service should:

- wait for `usb-media-ready`
- use a config directory under `$HOME/.config/navidrome`
- keep its database out of the USB media library unless you intentionally want
  it there
- run in the foreground

Start it:

```sh
sv up "$PREFIX/var/service/navidrome"
```

## Access

```text
http://android-media.local:4533/app/
```

Create the first admin user in the browser.

## Clients

Search for Subsonic-compatible music clients. Configure them with:

```text
Server: http://android-media.local:4533
User: your Navidrome user
Password: your Navidrome password
```

Keep passwords out of this repository and out of wiki examples.

## Upstream Docs

If you need Navidrome's own app reference, use [[Upstream Links]]. For the Note
20 build path, keep going here.

## Next

For audiobooks, use [[10 - Audiobookshelf]] instead of forcing Navidrome to do
everything.
