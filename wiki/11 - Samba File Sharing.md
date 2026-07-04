# 11 - Samba File Sharing

Samba makes the USB drive show up as a network drive.

On non-rooted Android, use port `1445`; privileged SMB port `445` is not the
normal path.

## Before You Start

Read:

- [[06 - USB Media Storage]]
- [[05 - Service Supervision]]
- [[Security]]

> [!NOTE]
> The example config uses an authenticated Samba user and a saved client
> credential.

## Values Used In This Guide

| Setting | Example |
|---|---|
| Phone IP | `192.168.1.50` |
| Friendly name | `android-media.local` |
| Samba port | `1445` |
| Share name | `media-drive` |
| Login shown to clients | `media-home` |

## Install Samba

```sh
pkg install samba
```

Create a config directory and copy the template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/samba"
cp templates/configs/smb-media-drive.conf "$HOME/samba/smb-media-drive.conf"
```

Edit the copy:

```sh
nano "$HOME/samba/smb-media-drive.conf"
```

Replace:

| Placeholder | Meaning |
|---|---|
| `192.168.1.50` | phone LAN IP |
| `<usb-volume-id>` | USB folder under `/mnt/media_rw/` |
| `<termux-android-uid>` | output of `whoami` in Termux |

Check the effective Termux user:

```sh
TERMUX_UID="$(whoami)"
printf '%s\n' "$TERMUX_UID"
```

## Create A Samba Password

Use the Termux user as the local account, but present `media-home` to laptops
through Samba's username map.

Create or update the Samba password for your effective Termux user:

```sh
smbpasswd -a "$TERMUX_UID"
```

Create the username map expected by the template:

```sh
printf '%s = media-home\n' "$TERMUX_UID" > "$HOME/samba/user.map"
chmod 600 "$HOME/samba/user.map"
```

In `$HOME/samba/smb-media-drive.conf`, the account-related lines should match
that choice:

```text
username map = /data/data/com.termux/files/home/samba/user.map
valid users = media-home
write list = media-home
force user = <termux-android-uid>
```

Replace `<termux-android-uid>` with the same `whoami` value.

Keep the password out of this repository, shell history, and docs.

## Run It Under Runit

Install the service template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/smbd-android"
cp templates/services/smbd-android/run "$PREFIX/var/service/smbd-android/run"
chmod +x "$PREFIX/var/service/smbd-android/run"
sv up "$PREFIX/var/service/smbd-android"
```

## Validate Locally

```sh
testparm -s "$HOME/samba/smb-media-drive.conf"
timeout 3 sh -c '</dev/tcp/127.0.0.1/1445' && echo "1445 open"
timeout 3 sh -c '</dev/tcp/127.0.0.1/445' || echo "445 closed"
```

> [!TIP]
> If local validation works but your laptop cannot connect, jump to
> [[Troubleshooting#samba-client-cannot-connect]].

## Connect From Clients

Use:

```text
smb://android-media.local:1445/media-drive
```

On Windows, use the equivalent UNC form with the custom port if the client
supports it, or connect by IP using a client that allows non-standard SMB ports.
Windows SMB discovery is not the main target of this guide yet.

## Next

For browser access to files, add [[12 - File Portal]].
