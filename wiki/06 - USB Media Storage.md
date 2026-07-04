# 06 - USB Media Storage

USB storage is the part that decides whether the media apps should run.

If the drive is missing, Jellyfin should not scan, Samba should not serve an
empty path, and the file portal should not show an empty tree as if everything
is fine.

## Expected Path

Android usually mounts removable storage under:

```text
/mnt/media_rw/<usb-volume-id>
```

In this guide we write:

```text
/mnt/media_rw/<usb-volume-id>
```

Replace `<usb-volume-id>` with the actual folder name on your phone.

## Find The Drive

Plug in the drive, then run:

```sh
grep -E 'media_rw.*(sdfat|exfat)' /proc/mounts
ls -ld /mnt/media_rw/*
```

You want a readable directory and a mount line that looks like removable
storage. For the stock guide, the drive should be exFAT. Samsung devices often
report exFAT as `sdfat` in `/proc/mounts`.

> [!TIP]
> Trust `/proc/mounts` first. Some normal Linux block tools are missing or
> permission-limited inside non-rooted Termux.

## Basic Readiness Test

```sh
USB_ROOT="/mnt/media_rw/<usb-volume-id>"
test -d "$USB_ROOT" || echo "missing"
test -r "$USB_ROOT" || echo "not readable"
ls "$USB_ROOT" >/dev/null && echo "readable"
```

Recommended top-level folders:

```text
Movies/
Shows/
Music/
Audiobooks/
Podcasts/
```

## Why Services Wait For USB

When the USB drive is missing:

- Jellyfin scans fail or remove paths from view
- Samba can accidentally serve the wrong thing
- file portals show empty folders
- Audiobookshelf and Navidrome waste time scanning nothing

So the gateway checker should start USB-dependent services only after storage is
really mounted and readable.

> [!WARNING]
> If Jellyfin, Samba, and the file portal fail together, debug storage first.
> Jump to [[Troubleshooting#usb-drive-missing]].

## A Tiny Checker

The template helper is:

```text
templates/bin/usb-media-ready
```

Install it as:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/bin"
cp templates/bin/usb-media-ready "$HOME/bin/usb-media-ready"
chmod +x "$HOME/bin/usb-media-ready"
```

Then edit the `USB_ROOT` value inside the script.

Validate it:

```sh
"$HOME/bin/usb-media-ready"
```

Expected output:

```text
usb_media=ok path="/mnt/media_rw/<usb-volume-id>"
```

If it reports `not_exfat_or_sdfat`, either the drive is not exFAT or Android is
reporting a filesystem type the stock helper does not accept. For the first
build, reformat as exFAT. For a custom filesystem, edit the case statement in
`$HOME/bin/usb-media-ready` and retest before enabling media services.

## Next

Set up the friendly LAN name: [[07 - Friendly LAN Name]].
