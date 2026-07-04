# N20 Home Dashboard

LAN-only web dashboard for the Samsung Galaxy Note 20 NAS.

## Quick facts

| Item | Value |
|---|---|
| URL | `http://android-media.local:8080/` |
| Stack | Python 3.13 stdlib `ThreadingHTTPServer` + vanilla HTML/CSS/JS |
| Service | `n20-home-dashboard` under `termux-services` / runit |
| Bind | `192.168.1.50:8080` as the example LAN address |
| Refresh | 12 s polling |

The public hostname is intentionally an example. Set
`N20_DASHBOARD_PUBLIC_NAME` to your own mDNS name, such as
`android-media.local`, and set `N20_DASHBOARD_HOST` to your phone's real LAN IP.
`192.168.1.50` is only a sample. Set `N20_DASHBOARD_PROBE_HOST` to the address
the phone should use when checking local services. `127.0.0.1` is usually enough
because the dashboard runs on the same device as the media services.

## Directory layout

```
n20-home-dashboard/
  server/
    n20-dashboard-server.py   ← Python HTTP server + telemetry collector
  public/
    index.html                ← Dashboard markup
    css/                      ← Theme and responsive dashboard layout
    js/                       ← Polling, formatting, and DOM updates
  service/
    run                       ← runit start script
    log/run                   ← runit log script
  activity.jsonl              ← Rolling event log (created at runtime)
  README.md
```

## Telemetry sources

| Metric | Source |
|---|---|
| Host identity | `getprop ro.product.model`, `getprop ro.build.version.release` |
| Uptime / load avg | `uptime` command |
| Battery | `termux-battery-status` (Termux:API) |
| Wi-Fi | `termux-wifi-connectioninfo` (Termux:API) |
| CPU frequencies | `/sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq` |
| Memory / swap | `/proc/meminfo` |
| USB storage | `df` + `/proc/mounts` + `du -sh` for top folders |
| Internal storage | `df /data` |
| Service health | TCP/HTTP probes + `sv status` |

## Intentionally omitted (not available without root)

- System-wide CPU utilization percentage
- Per-core CPU usage percentages
- USB disk read/write throughput
- Network RX/TX byte counters
- GPU utilization, frequency, temperature, or memory
- Raw thermal zone temperatures

## Deploy

```sh
# On the Samsung Note 20:
mkdir -p ~/n20-home-dashboard
# Copy server/, public/, service/ from this repo

# Create runit service
ln -s ~/n20-home-dashboard/service "$PREFIX/var/service/n20-home-dashboard"

# Start
sv up "$PREFIX/var/service/n20-home-dashboard"
```

## Operations

```sh
sv status "$PREFIX/var/service/n20-home-dashboard"
sv restart "$PREFIX/var/service/n20-home-dashboard"
tail -80 "$PREFIX/var/log/sv/n20-home-dashboard/current"
```

## Rollback

```sh
sv down "$PREFIX/var/service/n20-home-dashboard"
rm "$PREFIX/var/service/n20-home-dashboard"
```
