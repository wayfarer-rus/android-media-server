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
```

Copy the template and edit it:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/.config/navidrome"
cp templates/configs/navidrome.toml "$HOME/.config/navidrome/navidrome.toml"
nano "$HOME/.config/navidrome/navidrome.toml"
```

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
