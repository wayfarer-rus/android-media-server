# android-media-server

Public guide workspace for turning a Samsung Note 20 into a LAN-only home media
server with Termux.

The goal is a GitHub Wiki that regular people can follow: install Termux, set
up service supervision, attach USB media storage, and run Jellyfin, Navidrome,
Samba, a file portal, a small dashboard, and optional Audiobookshelf.

## Public Drafts

- `wiki/`: draft GitHub Wiki pages.
- `services/n20-home-dashboard/`: dashboard source for port `8080`.
- `templates/`: sanitized config and service examples used by the wiki.

## Dashboard

The dashboard is part of the project. It is designed to run on the phone as a
Termux/runit service and serve:

```text
http://android-media.local:8080/
```

`android-media.local` is an example friendly LAN name. Readers should set their
own name with `N20_DASHBOARD_PUBLIC_NAME`.

## Private Source Material

This local workspace may contain private working material, local configs,
archives, and media workflow artifacts used to write the public guide. Those are
not public material. See `.gitignore` before creating a public repository.

Do not publish:

- private working notes
- live configs exported from a device
- app databases or credential files
- SSH keys or `authorized_keys`
- actual media files or private library listings
- local IPs, local hostnames, router domains, machine usernames, Android app
  UIDs, or USB volume IDs

## Wiki Source

The GitHub Wiki pages are kept in `wiki/` so they can be reviewed with the
dashboard source and service templates.
