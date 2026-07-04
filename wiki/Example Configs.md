# Example Configs

This page points to sanitized templates in the repository.

They are examples. Read them before running them.

## Template Layout

```text
templates/
  boot/
    00-start-android-media-services
  bin/
    android-mdns-responder
    gateway-services-check
    jellyfin-ffmpeg-compat-wrapper
    runit-supervisor-watchdog
    usb-media-ready
  configs/
    filebrowser-quantum.yaml
    navidrome.toml
    smb-media-drive.conf
  services/
    audiobookshelf/run
    filebrowser-quantum/run
    gateway-service-watch/run
    jellyfin/run
    mdns-android/run
    n20-home-dashboard/run
    navidrome/run
    sshd/run
    smbd-android/run
```

## Replace These Values

| Placeholder | Replace with |
|---|---|
| `192.168.1.50` | your phone's LAN IP |
| `android-media.local` | your friendly LAN name |
| `<usb-volume-id>` | your USB mount folder |
| `<termux-android-uid>` | output of `whoami` in Termux |
| `media-home` | your chosen Samba login |
| `media-drive` | your chosen Samba share name |

## Install Helpers

From the repository on the phone:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/bin"
cp templates/bin/usb-media-ready "$HOME/bin/usb-media-ready"
cp templates/bin/gateway-services-check "$HOME/bin/gateway-services-check"
cp templates/bin/runit-supervisor-watchdog "$HOME/bin/runit-supervisor-watchdog"
cp templates/bin/android-mdns-responder "$HOME/bin/android-mdns-responder"
cp templates/bin/jellyfin-ffmpeg-compat-wrapper "$HOME/bin/jellyfin-ffmpeg-compat-wrapper"
chmod +x "$HOME/bin/"*
```

Edit the files before using them.

Install the boot script:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/.termux/boot"
cp templates/boot/00-start-android-media-services \
  "$HOME/.termux/boot/00-start-android-media-services"
chmod 700 "$HOME/.termux/boot/00-start-android-media-services"
chmod 600 "$HOME/.termux/boot"/*.bak* 2>/dev/null || true
```

## Install Services

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/mdns-android"
cp templates/services/mdns-android/run "$PREFIX/var/service/mdns-android/run"
chmod +x "$PREFIX/var/service/mdns-android/run"
```

Repeat for the services you actually want.

> [!TIP]
> If a service does not start, check [[Troubleshooting#service-will-not-start]]
> before changing several things at once.

## Config Philosophy

The templates try to stay plain:

- bind to the phone LAN IP
- keep services LAN-only
- wait for USB before starting media services
- run daemons in the foreground
- avoid storing secrets in the repository

That plain shape is the point.
