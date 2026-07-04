# Android Media Server

Turn a Samsung Note 20 into a small LAN media server with Termux, runit, and a
USB drive.

This is a fun old-phone experiment that can still produce a useful home box:
video, music, optional audiobooks, file access, SSH, a friendly LAN name, and a
small dashboard on port `8080`.

## Start Here

Read the first pages in order:

1. [[01 - What We Are Building]]
2. [[02 - Requirements]]
3. [[03 - First Termux Setup]]
4. [[04 - SSH Access]]
5. [[04A - Project Files On The Phone]]
6. [[04B - SSH Runit Service]]
7. [[05 - Service Supervision]]
8. [[06 - USB Media Storage]]

After that, add the services you want.

## Service Pages

| Page | Purpose |
|---|---|
| [[07 - Friendly LAN Name]] | `android-media.local` on the home LAN |
| [[08 - Jellyfin]] | Movies and shows |
| [[09 - Navidrome]] | Music |
| [[10 - Audiobookshelf]] | experimental audiobooks and podcasts service |
| [[11 - Samba File Sharing]] | Network-drive access on port `1445` |
| [[12 - File Portal]] | Browser-based file access |
| [[13 - Dashboard on Port 8080]] | Service status and device basics |

The full port map lives in [[01 - What We Are Building#network-map]].

## Daily Pages

- [[14 - Daily Operations]]: short checks, restarts, and reboot follow-up
- [[15 - Watchdog and Recovery]]: how the phone repairs damaged supervision
- [[Troubleshooting]]: symptom-based repair notes
- [[Security]]: LAN scope, credentials, and public-repo hygiene
- [[Example Configs]]: sanitized templates included in this repository

## Working Assumptions

The guide assumes a non-rooted phone on a private LAN. The examples use:

| Value | Example |
|---|---|
| Phone IP | `192.168.1.50` |
| Friendly name | `android-media.local` |
| USB path | `/mnt/media_rw/<usb-volume-id>` |

Change the examples to match your own router and USB volume. If the dashboard
loads but a service card looks wrong, start with [[Troubleshooting#dashboard-shows-a-service-down]]
instead of changing unrelated configs.
