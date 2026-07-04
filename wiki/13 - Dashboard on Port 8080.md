# 13 - Dashboard on Port 8080

The dashboard is the front door for the whole phone.

It runs here:

```text
http://android-media.local:8080/
```

The source lives in this repository:

```text
services/n20-home-dashboard/
```

## Why Port 8080?

Port `80` is a privileged port. On a normal non-rooted Android/Termux setup,
binding to it is usually not available.

Port `8080` is ordinary, familiar, and works without root.

## Install

On the phone:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/n20-home-dashboard"
cp -a services/n20-home-dashboard/server \
  services/n20-home-dashboard/public \
  services/n20-home-dashboard/service \
  "$HOME/n20-home-dashboard/"
chmod +x "$HOME/n20-home-dashboard/service/run"
```

Edit:

```text
~/n20-home-dashboard/service/run
```

Set:

```sh
export N20_DASHBOARD_HOST=192.168.1.50
export N20_DASHBOARD_PORT=8080
export N20_DASHBOARD_PROBE_HOST=127.0.0.1
export N20_DASHBOARD_PUBLIC_NAME=android-media.local
```

`N20_DASHBOARD_HOST` is the phone's real LAN IP. `N20_DASHBOARD_PROBE_HOST` can
usually stay `127.0.0.1` because the dashboard checks services from the phone
itself.

## Enable The Service

```sh
ln -s "$HOME/n20-home-dashboard/service" "$PREFIX/var/service/n20-home-dashboard"
sv up "$PREFIX/var/service/n20-home-dashboard"
```

Check:

```sh
curl -I http://127.0.0.1:8080/
curl -I http://192.168.1.50:8080/
```

From a laptop:

```text
http://android-media.local:8080/
```

## What It Shows

The dashboard can show:

- service reachability
- runit service state
- memory
- swap
- CPU frequency basics
- internal storage use
- USB storage state
- recent dashboard activity

It may also show battery or Wi-Fi details if Termux:API is installed and
responds quickly.

## Limits

Without root, these fields are usually unavailable or unreliable:

- system-wide CPU percentage
- per-core CPU utilization
- raw USB I/O counters
- Wi-Fi byte counters
- GPU utilization
- every thermal sensor

That is fine. The dashboard is a practical health page, not a full observability
stack.

> [!TIP]
> If Termux:API hangs, the dashboard should keep working with missing battery or
> Wi-Fi fields. See [[Troubleshooting#termuxapi-hangs-or-returns-no-data]].

## Operations

```sh
sv status "$PREFIX/var/service/n20-home-dashboard"
sv restart "$PREFIX/var/service/n20-home-dashboard"
```

If the dashboard is up but cards show services down, go to
[[Troubleshooting#dashboard-shows-a-service-down]].

## Next

Build your daily checklist: [[14 - Daily Operations]].
