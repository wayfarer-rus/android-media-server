# 03 - First Termux Setup

This is the first pass after installing Termux.

## Update Packages

Open Termux on the phone:

```sh
pkg update
pkg upgrade
```

Install the basics:

```sh
pkg install openssh termux-services python git curl jq ripgrep nano unzip
```

## Know The Two Important Roots

Termux uses two paths constantly:

| Variable | Usually points to | What lives there |
|---|---|---|
| `$HOME` | `/data/data/com.termux/files/home` | your files, configs, scripts, app state |
| `$PREFIX` | `/data/data/com.termux/files/usr` | Termux packages, binaries, libraries, runit services |

Check them on your phone:

```sh
printf 'HOME=%s\n' "$HOME"
printf 'PREFIX=%s\n' "$PREFIX"
```

When this guide says:

```text
$PREFIX/var/service/jellyfin
```

it means the Jellyfin runit service directory inside Termux's own package tree.
See [[Glossary#prefix]] if you want the short version later.

If you want optional dashboard battery/Wi-Fi details:

```sh
pkg install termux-api
```

> [!TIP]
> Termux:API also needs the Android Termux:API app. The package alone is not
> enough. It is optional; the media server works without it.

## Give Termux Storage Access

Run:

```sh
termux-setup-storage
```

Android will ask for permission. Allow it.

This creates convenient links under:

```text
~/storage/
```

The external USB drive will still usually appear under:

```text
/mnt/media_rw/<usb-volume-id>
```

We will validate that properly in [[06 - USB Media Storage]].

## Keep The Phone Awake Enough

Disable battery optimization for:

- Termux
- Termux:Boot
- Termux:API, if installed

Different Android builds hide this setting in different places. Search Android
settings for "battery optimization", "unrestricted", or "background usage".

> [!WARNING]
> This does not make Android behave like a server OS. It only reduces surprise.
> The watchdog strategy in [[05 - Service Supervision]] still matters.

## Find Your LAN IP

Try:

```sh
ip -4 addr show wlan0
```

You are looking for something like:

```text
192.168.1.50
```

Reserve that address in your router if your router supports DHCP reservations.

> [!TIP]
> If the IP changes later, update [[07 - Friendly LAN Name]],
> [[11 - Samba File Sharing]], and [[13 - Dashboard on Port 8080]].

## Next

Set up remote administration: [[04 - SSH Access]].
