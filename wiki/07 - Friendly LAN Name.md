# 07 - Friendly LAN Name

Typing `192.168.1.50` gets old fast. A friendly name like
`android-media.local` is easier to remember.

This guide uses a small mDNS responder supervised by runit.

## What mDNS Does

mDNS lets devices on the same LAN resolve names ending in `.local`.

Example:

```text
android-media.local -> 192.168.1.50
```

That means your dashboard can live at:

```text
http://android-media.local:8080/
```

> [!WARNING]
> mDNS gives you a name, not port discovery. Samba still needs
> `:1445`, the dashboard still needs `:8080`, and Jellyfin still needs `:8096`.

## Install The Helper

Use the sanitized template:

```text
templates/bin/android-mdns-responder
```

Copy it to the phone:

```sh
cd "$HOME/android-media-server"
cp templates/bin/android-mdns-responder "$HOME/bin/android-mdns-responder"
chmod +x "$HOME/bin/android-mdns-responder"
```

The helper reads environment variables. Edit the service template values, not
the Python helper:

```text
templates/services/mdns-android/run
```

The important values are:

| Variable | Example |
|---|---|
| `ANDROID_MEDIA_LAN_IP` | `192.168.1.50` |
| `ANDROID_MEDIA_MDNS_NAME` | `android-media.local` |
| `ANDROID_MEDIA_SMB_PORT` | `1445` |

## Run It Under Runit

Create a service directory:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/mdns-android"
cp templates/services/mdns-android/run "$PREFIX/var/service/mdns-android/run"
chmod +x "$PREFIX/var/service/mdns-android/run"
nano "$PREFIX/var/service/mdns-android/run"
sv up "$PREFIX/var/service/mdns-android"
```

## Test From A Laptop

```sh
ping android-media.local
ssh -p 8022 <termux-user>@android-media.local 'echo ssh-ok'
```

For Samba:

```text
smb://android-media.local:1445/media-drive
```

> [!TIP]
> If the name does not resolve but direct IP works, go to
> [[Troubleshooting#mdns-name-does-not-resolve]].

## Next

Install a media service, starting with [[08 - Jellyfin]] or [[09 - Navidrome]].
