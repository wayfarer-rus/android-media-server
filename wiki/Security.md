# Security

This page collects the security assumptions used by the guide.

## Network Scope

The examples assume the phone is reachable from the home LAN at a private
address such as:

```text
192.168.1.50
```

Remote access is a separate topic. A VPN-first setup fits this design best
because it keeps the service configuration the same on the phone.

## Passwords And Secrets

Keep these out of GitHub:

- Samba passwords
- Jellyfin admin password
- Navidrome password
- Audiobookshelf admin credentials
- SSH private keys
- API tokens
- app databases

Use placeholders in docs:

```text
<password>
<phone-lan-ip>
<usb-volume-id>
```

## Samba

The Samba examples use:

- authenticated users
- port `1445`
- LAN allow rules

See [[11 - Samba File Sharing]].

## Dashboard

The dashboard listens on the phone LAN IP:

```text
http://android-media.local:8080/
```

## Termux:API

Termux:API can expose Android device information to command-line tools. In this
guide, it is optional and used only for nice-to-have dashboard fields.

If it acts strangely, leave those dashboard fields blank. The core services do
not need it.

## Public Repo Hygiene

Before publishing, scan the tracked public files for private local identifiers:

```sh
rg -n '<private-hostname>|<private-lan-prefix>|<local-username>|<usb-volume-id>|<media-title>' \
  README.md .gitignore docs wiki services templates
```

Then inspect any hits manually.

> [!WARNING]
> A private LAN IP is not a credential, but publishing your exact hostnames,
> router domain, media titles, local usernames, and logs can still identify your
> setup. Use examples unless the exact value helps readers.
