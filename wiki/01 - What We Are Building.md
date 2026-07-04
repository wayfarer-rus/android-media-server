# 01 - What We Are Building

A Samsung Note 20 runs Termux services against a USB media drive and exposes
them only on the home LAN.

The important pieces are simple: one service supervisor, one USB readiness
check, one dashboard, and one set of LAN names and ports.

## Network Map

| Service | Role | URL or port |
|---|---|---|
| Dashboard | service status and device basics | `http://android-media.local:8080/` |
| Jellyfin | movies and shows | `http://android-media.local:8096/` |
| Navidrome | music | `http://android-media.local:4533/app/` |
| Audiobookshelf | optional advanced audiobook service | `http://android-media.local:13378/audiobookshelf/` |
| Samba | network-drive access | `smb://android-media.local:1445/media-drive` |
| File portal | browser file access | `http://android-media.local:8088/` |
| SSH | administration | `ssh -p 8022 <termux-user>@192.168.1.50` |
| mDNS | friendly LAN name | `android-media.local` |

Use `192.168.1.50` as the example phone IP throughout the guide. Reserve the
real address in your router if possible.

## Layout

```text
LAN clients
    |
    | Wi-Fi / LAN
    |
android-media.local  192.168.1.50
    |
    | Termux
    | runit / termux-services
    |
    +-- dashboard, SSH, mDNS
    +-- media services after USB is ready
    |
    +-- /mnt/media_rw/<usb-volume-id>
```

The USB path is the shared foundation. If Jellyfin, Samba, and the file portal
all fail together, jump straight to [[Troubleshooting#usb-drive-missing]].

The core build is SSH, USB readiness, dashboard, mDNS, Jellyfin, Navidrome,
Samba, file portal, service supervision, and watchdog recovery. Audiobookshelf
is included as an advanced optional service because its native Android/Termux
build can run, but the scanner is heavy enough that it should not be treated as
part of the guaranteed first pass. See [[10 - Audiobookshelf#scanner-performance]].

## Main Constraints

This guide assumes:

- no root
- no Docker
- services bound to the phone's LAN IP
- SSH on `8022`
- Samba on `1445`
- dashboard on `8080`
- USB-backed services started only after storage is readable

Those choices fit Android/Termux better than treating the phone like a normal
Linux server.

## Service Model

Termux services run inside Android's background-app model. Android may stop
work that looks too eager, especially after sleep, USB changes, or app restarts.

The setup therefore uses [[05 - Service Supervision]]:

- runit through `termux-services`
- foreground services
- a gateway checker for USB-dependent services
- a watchdog path for damaged supervision

## Dashboard

The dashboard source is included in:

```text
services/n20-home-dashboard/
```

It is the quick status page, not the whole diagnosis. If a card says a service
is down, check the service and the shared foundations through [[Troubleshooting]]
before editing configs.

## Next

Collect the hardware, apps, and example values in [[02 - Requirements]].
