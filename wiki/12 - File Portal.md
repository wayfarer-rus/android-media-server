# 12 - File Portal

The file portal gives the media drive a browser UI on port `8088`.

It complements [[11 - Samba File Sharing]]. Samba is better for a mounted
network drive and bulk copies. The file portal is better when a device only has
a browser, or when you want a quick upload/download link from
[[13 - Dashboard on Port 8080]].

## Prerequisites

Complete these first:

- [[03 - First Termux Setup]]
- [[04 - SSH Access]]
- [[05 - Service Supervision]]
- [[06 - USB Media Storage]]
- [[07 - Friendly LAN Name]]

The examples below use:

| Setting | Value |
|---|---|
| Product | FileBrowser Quantum |
| Source tag | `v1.4.0-stable` |
| Tested commit | `4072e46` |
| Listen URL | `http://android-media.local:8088/` |
| LAN IP example | `192.168.1.50` |
| Binary path | `$HOME/.local/bin/filebrowser-quantum` |
| Config path | `$HOME/.config/filebrowser-quantum/config.yaml` |

## Why Build It

Use a native Termux build on the phone.

The generic Linux arm64 release binary can print its version, but server startup
can fail on Android/Termux with a `SIGSYS` crash around Linux syscall handling.
Building on Termux produces an Android/arm64 binary and avoids that mismatch.

The frontend also matters. FileBrowser Quantum is not just a Go backend. The
browser UI is built with npm/Vite and then embedded into the Go binary. If you
build only the backend, the service may start indexing files but fail to serve
the web UI because `index.html` was never embedded.

## Install Build Tools

Run this on the phone:

```sh
pkg update
pkg install git golang nodejs-lts clang make pkg-config sqlite
```

Check the tools:

```sh
go version
node --version
npm --version
```

A working build was verified with Go reporting `android/arm64`. Newer Termux
packages are fine; keep the build native on the phone.

## Get The Source

Keep the checkout under internal storage, not the USB drive:

```sh
mkdir -p "$HOME/.local/src" "$HOME/.local/bin"
cd "$HOME/.local/src"

git clone https://github.com/gtsteffaniak/filebrowser.git filebrowser-quantum
cd filebrowser-quantum
git fetch --tags
git checkout v1.4.0-stable
git rev-parse --short HEAD
```

Expected short commit:

```text
4072e46
```

If the commit differs because you chose a newer tag, keep going, but treat it as
an upgrade. Re-check the upstream release notes from [[Upstream Links]].

## Build The Frontend

The frontend build writes static files into the backend embed directory:

```sh
cd "$HOME/.local/src/filebrowser-quantum/frontend"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

npm ci
npm run build
```

Verify the embedded UI files:

```sh
test -r ../backend/http/dist/index.html
test -r ../backend/http/embed/index.html
```

If either check fails, stop there and fix the frontend build first. A backend
binary without embedded UI files is a half-built portal.

## Build The Backend

Build from the backend directory:

```sh
cd "$HOME/.local/src/filebrowser-quantum/backend"

export CGO_ENABLED=1
export GOOS=android
export GOARCH=arm64
export CC="${CC:-$(command -v aarch64-linux-android-clang)}"

go mod download
go build -trimpath \
  -ldflags "-s -w -X github.com/gtsteffaniak/filebrowser/backend/common/version.Version=v1.4.0-stable -X github.com/gtsteffaniak/filebrowser/backend/common/version.CommitSHA=4072e46" \
  -o "$HOME/.local/bin/filebrowser-quantum" \
  .

chmod 700 "$HOME/.local/bin/filebrowser-quantum"
```

Check the binary:

```sh
"$HOME/.local/bin/filebrowser-quantum" version
```

Expected output includes:

```text
FileBrowser Quantum
Version    : v1.4.0-stable
Commit     : 4072e46
```

> [!TIP]
> Build while the phone is charging and cool. The first `npm ci`, Vite build,
> and Go module download are the slow parts. If Android kills the shell, run the
> same command again; npm and Go caches usually save most of the repeated work.

## Configure

From the repository checkout on the phone, install the sanitized config:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/.config/filebrowser-quantum" \
  "$HOME/.local/share/filebrowser-quantum" \
  "$HOME/.cache/filebrowser-quantum" \
  "$HOME/.local/state/filebrowser-quantum"

cp templates/configs/filebrowser-quantum.yaml \
  "$HOME/.config/filebrowser-quantum/config.yaml"

nano "$HOME/.config/filebrowser-quantum/config.yaml"
```

Set these values:

| Config key | Example | Notes |
|---|---|---|
| `server.listen` | `192.168.1.50` | Use the phone LAN IP |
| `server.port` | `8088` | Keep it above privileged ports |
| `server.sources[0].path` | `/mnt/media_rw/<usb-volume-id>` | Use the real USB mount |
| `server.sources[0].name` | `media-drive` | Display name in the UI |
| `auth.adminUsername` | `media-home` | Use your chosen household login |
| `auth.methods.password.signup` | `false` | Keep public signup closed |
| `server.disableWebDAV` | `true` | Browser access only |
| `server.disableUpdateCheck` | `true` | Keep service startup quiet |

Create the password file used by the runit service:

```sh
nano "$HOME/.config/filebrowser-quantum/admin-password.txt"
chmod 600 "$HOME/.config/filebrowser-quantum/admin-password.txt"
```

The password file should contain only the password text and one newline.

## Run Under Runit

Install the service template:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/filebrowser-quantum"
cp templates/services/filebrowser-quantum/run \
  "$PREFIX/var/service/filebrowser-quantum/run"
chmod +x "$PREFIX/var/service/filebrowser-quantum/run"
```

Edit the service file:

```sh
nano "$PREFIX/var/service/filebrowser-quantum/run"
```

Replace:

| Placeholder | Replace with |
|---|---|
| `/mnt/media_rw/<usb-volume-id>` | the same USB mount used in the config |
| `$HOME/.config/filebrowser-quantum/config.yaml` | your config path, if changed |
| `$HOME/.local/bin/filebrowser-quantum` | your binary path, if changed |

Start it:

```sh
sv up "$PREFIX/var/service/filebrowser-quantum"
```

The service waits for the USB mount before it starts the portal. If it keeps
restarting, check [[Troubleshooting#file-portal-service-loops]].

## Check

Check supervision:

```sh
sv status "$PREFIX/var/service/filebrowser-quantum"
```

Check the page with `GET`, not `HEAD`:

```sh
curl -4 --max-time 8 -sS http://192.168.1.50:8088/ | sed -n '1,5p'
```

Then open:

```text
http://android-media.local:8088/
```

Log in with the configured admin username and the password from
`admin-password.txt`.

After login, confirm:

- the root view shows the USB media folders
- search can find a known folder name
- a small download works
- uploads are tested only in a folder where you are comfortable writing files

If the page loads but the tree is empty, go straight to
[[Troubleshooting#file-portal-is-empty]].

## Related

- [[11 - Samba File Sharing]]
- [[13 - Dashboard on Port 8080]]
- [[Troubleshooting#file-portal-build-fails]]
- [[Troubleshooting#file-portal-service-loops]]
- [[Upstream Links]]
