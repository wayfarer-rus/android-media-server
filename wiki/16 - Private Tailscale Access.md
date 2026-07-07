# 16 - Private Tailscale Access

Tailscale can provide private device-to-device access to the phone without
router port forwarding or public tunnels.

This page covers the Termux-native path. It needs a little more care than the
normal Android app because Termux does not get Android's VPNService privileges.

## Scope

Keep Tailscale as a private overlay only:

- no router port forwarding
- no public reverse proxy
- no Tailscale Funnel
- no exit node
- no subnet router
- no advertised routes
- no ACL or admin-console changes from the phone

Trusted clients should use one Tailscale name or Tailscale IP at home and away.
Applications should not need separate LAN and remote profiles.

## Termux Networking

On non-rooted Android, Termux normally cannot open `/dev/net/tun`:

```sh
python3 - <<'PY'
import os
try:
    os.open("/dev/net/tun", os.O_RDWR)
    print("tun open")
except OSError as e:
    print(e)
PY
```

If that prints `Permission denied`, native `tailscaled` cannot use normal kernel
TUN mode. Use:

```text
--tun=userspace-networking
```

Generic Linux ARM64 release binaries may also fail under Android seccomp with
`SIGSYS`. If that happens, build from the upstream `tailscale.com` module on the
phone with `GOOS=android` and `GOARCH=arm64`.

## Build

Use the tested version unless you are deliberately updating the guide:

```text
Tailscale: 1.98.8
Go: android/arm64
Source: tailscale.com v1.98.8
Build tags: ts_omit_ssh,ts_omit_systray,ts_termux_netmon,ts_omit_taildrop
```

Install the build tools:

```sh
pkg install golang git curl tar
```

Create the build layout:

```sh
VERSION=1.98.8
APPDIR="$HOME/apps/tailscale"
SRC="$APPDIR/src/v$VERSION-termux"
BUILD="$APPDIR/build-native/v$VERSION-android-arm64-termux"
REL="$APPDIR/releases/$VERSION-android-arm64-termux"

mkdir -p "$APPDIR/src" "$BUILD" "$APPDIR/releases"
```

Check the official release artifact first. The generic Linux ARM64 binary may
not run on Android, but the package and checksum are still useful upstream
signals:

```sh
cd "$APPDIR"
TGZ="tailscale_${VERSION}_arm64.tgz"
curl -fsSLO "https://pkgs.tailscale.com/stable/$TGZ"
want="$(curl -fsSL "https://pkgs.tailscale.com/stable/$TGZ.sha256" | awk '{print $1}')"
got="$(sha256sum "$TGZ" | awk '{print $1}')"
[ "$want" = "$got" ] || {
  echo "checksum mismatch" >&2
  exit 1
}

mkdir -p "$APPDIR/release-check"
tar -xzf "$TGZ" -C "$APPDIR/release-check" --strip-components=1
"$APPDIR/release-check/tailscale" version || true
```

If that last command fails with `SIGSYS` or `bad system call`, keep going with a
native Android build.

Fetch the upstream Go module:

```sh
FETCH="$APPDIR/build-native/modfetch"
mkdir -p "$FETCH"
cd "$FETCH"
go mod init local/tailscale-fetch 2>/dev/null || true
go mod download -json "tailscale.com@v$VERSION" > module.json

MOD_DIR="$(
  sed -n 's/^[[:space:]]*"Dir": "\(.*\)",$/\1/p' module.json | head -1
)"
[ -n "$MOD_DIR" ] || {
  echo "could not find module dir" >&2
  exit 1
}

rm -rf "$SRC"
mkdir -p "$SRC"
cp -a "$MOD_DIR/." "$SRC/"
chmod -R u+rwX "$SRC"
```

Add the Termux network monitor fallback. This avoids Android-restricted
`net.Interfaces()` and netlink route probes during daemon startup:

```sh
cat > "$SRC/cmd/tailscaled/termux_netmon_android.go" <<'EOF'
// Copyright (c) Tailscale Inc & contributors
// SPDX-License-Identifier: BSD-3-Clause

//go:build android && ts_termux_netmon

package main

import (
	"fmt"
	"net"
	"net/netip"
	"os"
	"strconv"
	"strings"

	"tailscale.com/net/netmon"
)

func init() {
	if os.Getenv("TS_TERMUX_NETMON_FALLBACK") != "1" {
		return
	}
	ifaceName := strings.TrimSpace(os.Getenv("TS_TERMUX_NETMON_IFACE"))
	if ifaceName == "" {
		ifaceName = "wlan0"
	}
	netmon.UpdateLastKnownDefaultRouteInterface(ifaceName)
	netmon.RegisterInterfaceGetter(func() ([]netmon.Interface, error) {
		ifaceName := strings.TrimSpace(os.Getenv("TS_TERMUX_NETMON_IFACE"))
		if ifaceName == "" {
			ifaceName = "wlan0"
		}
		idx := 1
		if raw := strings.TrimSpace(os.Getenv("TS_TERMUX_NETMON_IFINDEX")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed <= 0 {
				return nil, fmt.Errorf("invalid TS_TERMUX_NETMON_IFINDEX %q", raw)
			}
			idx = parsed
		}
		mtu := 1500
		if raw := strings.TrimSpace(os.Getenv("TS_TERMUX_NETMON_MTU")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed <= 0 {
				return nil, fmt.Errorf("invalid TS_TERMUX_NETMON_MTU %q", raw)
			}
			mtu = parsed
		}

		var addrs []net.Addr
		if raw := strings.TrimSpace(os.Getenv("TS_TERMUX_NETMON_IPV4_PREFIX")); raw != "" {
			pfx, err := netip.ParsePrefix(raw)
			if err != nil {
				return nil, fmt.Errorf("invalid TS_TERMUX_NETMON_IPV4_PREFIX %q: %w", raw, err)
			}
			if !pfx.Addr().Is4() {
				return nil, fmt.Errorf("TS_TERMUX_NETMON_IPV4_PREFIX must be IPv4, got %q", raw)
			}
			addrs = append(addrs, &net.IPNet{
				IP:   net.IP(pfx.Addr().AsSlice()),
				Mask: net.CIDRMask(pfx.Bits(), pfx.Addr().BitLen()),
			})
		}

		return []netmon.Interface{{
			Interface: &net.Interface{
				Index: idx,
				MTU:   mtu,
				Name:  ifaceName,
				Flags: net.FlagUp | net.FlagBroadcast | net.FlagMulticast,
			},
			AltAddrs: addrs,
			Desc:     "Termux fallback interface",
		}}, nil
	})
}
EOF
```

The `ts_termux_netmon` patch should be small and build-tagged. It should
activate only when the service sets `TS_TERMUX_NETMON_FALLBACK=1`.

Build with one compiler worker. Full parallel builds can make a busy phone drop
SSH or restart Termux services:

```sh
cd "$SRC"
TAGS="ts_omit_ssh,ts_omit_systray,ts_termux_netmon,ts_omit_taildrop"
export CGO_ENABLED=0 GOOS=android GOARCH=arm64
export GOMAXPROCS=1 GOMEMLIMIT=700MiB

go build -trimpath -tags "$TAGS" -ldflags "-s -w" \
  -o "$BUILD/tailscale" ./cmd/tailscale

go build -trimpath -tags "$TAGS" -ldflags "-s -w" \
  -o "$BUILD/tailscaled" ./cmd/tailscaled

"$BUILD/tailscale" version
"$BUILD/tailscaled" --version
sha256sum "$BUILD/tailscale" "$BUILD/tailscaled"
```

Install the build:

```sh
mkdir -p "$REL"
cp "$BUILD/tailscale" "$BUILD/tailscaled" "$REL/"
chmod 700 "$REL/tailscale" "$REL/tailscaled"
ln -sfn "$REL" "$APPDIR/current"

cat > "$PREFIX/bin/tailscale" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
exec "$HOME/apps/tailscale/current/tailscale" \
  --socket="$HOME/.local/state/tailscale/tailscaled.sock" "$@"
EOF
chmod 700 "$PREFIX/bin/tailscale"

ln -sfn "$HOME/apps/tailscale/current/tailscaled" "$PREFIX/bin/tailscaled"
```

Build failure map:

| Symptom | Fix |
|---|---|
| Generic Linux ARM64 binary exits with `SIGSYS` or `bad system call` | Build native Android/arm64 from `tailscale.com` source. |
| Android build fails around Tailscale SSH packages | Add `ts_omit_ssh`; this guide does not use Tailscale SSH. |
| Build fails around desktop tray UI packages | Add `ts_omit_systray`; Termux is not a desktop tray environment. |
| `tailscaled` exits with `netlinkrib: permission denied` or `net.Interfaces` route errors | Add the `ts_termux_netmon` patch and set its environment variables in the runit service. |
| Login approval reaches the daemon, then it panics in `feature/taildrop` | Add `ts_omit_taildrop`; Taildrop is not required for NAS access. |
| Build causes SSH drops or runit recovery events | Rebuild while charging and quiet; keep `GOMAXPROCS=1` and `GOMEMLIMIT` set. |

## Service

Run `tailscaled` under runit. Set the fallback prefix to the phone's current LAN
address and subnet:

```sh
PHONE_LAN_PREFIX="192.168.1.50/24"
mkdir -p "$PREFIX/var/service/tailscaled"
```

Create the service:

```sh
cat > "$PREFIX/var/service/tailscaled/run" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
set -eu

export HOME=/data/data/com.termux/files/home
export PREFIX=/data/data/com.termux/files/usr
export PATH="\$HOME/apps/tailscale/current:\$PREFIX/bin:\$PATH"

BIN="\$HOME/apps/tailscale/current/tailscaled"
STATE_DIR="\$HOME/.local/state/tailscale"
LOG_DIR="\$HOME/log/tailscale"
LOG_FILE="\$LOG_DIR/tailscaled.log"
SOCKET="\$STATE_DIR/tailscaled.sock"

mkdir -p "\$STATE_DIR" "\$LOG_DIR"
chmod 700 "\$STATE_DIR" "\$LOG_DIR" 2>/dev/null || true
exec >> "\$LOG_FILE" 2>&1

export TS_TERMUX_NETMON_FALLBACK=1
export TS_TERMUX_NETMON_IFACE=wlan0
export TS_TERMUX_NETMON_IFINDEX=1
export TS_TERMUX_NETMON_MTU=1500
export TS_TERMUX_NETMON_IPV4_PREFIX="$PHONE_LAN_PREFIX"

rm -f "\$SOCKET"
exec "\$BIN" --tun=userspace-networking \\
  --statedir="\$STATE_DIR" \\
  --socket="\$SOCKET"
EOF

chmod 700 "$PREFIX/var/service/tailscaled/run"
```

Start it:

```sh
sv up "$PREFIX/var/service/tailscaled"
sv status "$PREFIX/var/service/tailscaled"
```

The service uses Termux-writable state and logs:

```text
$HOME/.local/state/tailscale/
$HOME/.local/state/tailscale/tailscaled.sock
$HOME/log/tailscale/tailscaled.log
```

The `tailscale` wrapper from the build step points the CLI at the non-default
socket.

Do not use `nohup ... &` for the daemon.

## Enrollment

Start the service first:

```sh
sv up "$PREFIX/var/service/tailscaled"
tailscale status
```

Enroll with a normal interactive browser approval:

```sh
tailscale up --hostname=android-media-nas
```

Do not use reusable auth keys, pre-auth keys, OAuth secrets, copied cookies, or
stored browser credentials in scripts.

## Validate

After approval:

```sh
tailscale version
tailscale status
tailscale ip -4
tailscale ip -6
tailscale netcheck
sv status "$PREFIX/var/service/tailscaled"
```

Check the service log:

```sh
tail -80 "$HOME/log/tailscale/tailscaled.log"
```

Confirm the node is not advertising routes or exit-node capability:

```sh
tailscale status --json
```

Review the JSON for `ExitNode`, `AdvertiseRoutes`, and Serve/Funnel state
before testing media services.

## Service Access

Try direct private URLs first:

```text
http://android-media-nas.<tailnet>.ts.net:8080/
http://android-media-nas.<tailnet>.ts.net:8096/
http://android-media-nas.<tailnet>.ts.net:8088/
http://android-media-nas.<tailnet>.ts.net:13378/audiobookshelf/
```

Userspace networking may not deliver arbitrary inbound TCP directly to services
bound only to the LAN address. If direct access fails, do not change media
services to `0.0.0.0` just to compensate.

Use private `tailscale serve` only after direct access is proven blocked, and
only for explicit local ports. Do not enable Funnel.

For LAN-bound HTTP services, keep the public port numbers the same and proxy the
specific LAN listener through private Serve:

```sh
tailscale serve --yes --bg --http=8080  http://<phone-lan-ip>:8080
tailscale serve --yes --bg --http=8088  http://<phone-lan-ip>:8088
tailscale serve --yes --bg --http=13378 http://<phone-lan-ip>:13378
tailscale serve --yes --bg --http=4533  http://<phone-lan-ip>:4533
```

These mappings are private to the tailnet. They are not Funnel. Access them by
MagicDNS hostname:

```text
http://android-media-nas.<tailnet>.ts.net:8080/
http://android-media-nas.<tailnet>.ts.net:8088/
http://android-media-nas.<tailnet>.ts.net:13378/audiobookshelf/
http://android-media-nas.<tailnet>.ts.net:4533/app/
```

When the dashboard is opened through the MagicDNS hostname, its service Open
links keep that same hostname and swap only the service port/path.

Direct services that already accept Tailscale traffic, such as Jellyfin or SMB
on some builds, can stay direct and do not need Serve.

If SSH is intentionally LAN-only, leave source-address restrictions in
`sshd_config` and do not add a Tailscale SSH path. A tailnet TCP connection may
reach `sshd`, but public-key login should remain denied for non-LAN source
addresses.

## Client Check

1. Install Tailscale on one trusted Mac, iPhone, iPad, or Android phone.
2. Sign in to the same personal tailnet.
3. Confirm the phone appears as an approved device.
4. Open the dashboard URL first.
5. Test Jellyfin, file portal, Samba, and other services after the basic checks
   pass.
6. Test SSH only if the deployment policy allows SSH from Tailscale clients.

## Rollback

```sh
tailscale serve reset 2>/dev/null || true
sv down "$PREFIX/var/service/tailscaled"
rm -rf "$PREFIX/var/service/tailscaled"
rm -f "$PREFIX/bin/tailscale" "$PREFIX/bin/tailscaled"
rm -rf "$HOME/apps/tailscale"
rm -rf "$HOME/.local/state/tailscale" "$HOME/.local/state/tailscale-install"
rm -rf "$HOME/log/tailscale"
```

If the gateway checker was edited to keep `tailscaled` up, remove `tailscaled`
from that core-service list before deleting the service.

## Related

- [[05 - Service Supervision]]
- [[Security]]
- [[Known Limitations]]
- [[Upstream Links]]
