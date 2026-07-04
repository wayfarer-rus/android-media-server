# 15 - Watchdog and Recovery

The watchdog keeps the Termux/runit service tree recoverable when Android kills
or strands background processes.

This is the part that makes the phone feel less like a lucky shell session and
more like a small server. Runit restarts one crashed process. The watchdog
repairs the supervisor itself when Android leaves the service tree in a weird
state.

## The Final Shape

The stable chain looks like this:

```text
Termux:Boot
  -> ~/.termux/boot/00-start-android-media-services
       -> runit-supervisor-watchdog, only when supervision looks damaged
       -> gateway-services-check

termux-services
  -> service-daemon
       -> runsvdir $PREFIX/var/service
            -> sshd
            -> mdns-android
            -> n20-home-dashboard
            -> gateway-service-watch
            -> Jellyfin, Navidrome, Samba, FileBrowser, Audiobookshelf

gateway-service-watch
  -> gateway-services-check every 10 seconds
       -> keep core LAN services up
       -> start media services only when USB is ready
       -> stop USB-dependent services when USB disappears
       -> queue the watchdog if runit is split-brained
```

The important separation is:

| Piece | Job |
|---|---|
| `runsvdir` | supervise service directories |
| `gateway-services-check` | enforce the desired up/down policy |
| `gateway-service-watch` | run the checker repeatedly while runit is alive |
| `runit-supervisor-watchdog` | repair missing, duplicated, or split-brain supervision |
| Termux:Boot script | kick the system once after Android starts Termux |

## What Failed First

The first broken state looked like a normal app problem. Jellyfin appeared to
restart over and over. Then Navidrome looked strange. Samba sometimes still
worked, which made the failure even less obvious.

The actual problem was lower down.

### Missing Supervisor

Sometimes `runsvdir` was simply gone. In that state:

```sh
pgrep -af runsvdir
sv status "$PREFIX/var/service/jellyfin"
```

could show no active supervisor, while some old services were still reachable.
Starting `service-daemon` fixed the simple version:

```sh
rm -f "$PREFIX/var/run/service-daemon.pid"
service-daemon start
"$HOME/bin/gateway-services-check"
```

That was not enough for the harder case.

### Split-Brain Runit

The nasty version had exactly one new `runsvdir`, but old `runsv` children were
still alive under parent PID `1`.

That meant a check like this could look healthy:

```text
runsvdir_count=1
```

while the tree was actually broken:

```text
orphan_runsv_count>0
```

Real examples from the build:

- a stale Navidrome process held port `4533`
- Jellyfin and Navidrome supervised PIDs churned
- Samba could appear healthy because an orphan supervisor still served it
- `sv status` and open ports disagreed

The lesson was simple: counting `runsvdir` is not enough. The checker also has
to ask whether the `runsv` children belong to that `runsvdir`.

### Executable Boot Backups

Termux:Boot runs executable files in:

```text
$HOME/.termux/boot
```

During the build, old backup boot scripts were still executable. Android ran
the real boot script and the backups. That briefly created duplicate supervisor
startup attempts.

The fix is strict:

```sh
chmod 700 "$HOME/.termux/boot/00-start-android-media-services"
chmod 600 "$HOME/.termux/boot"/*.bak* 2>/dev/null || true
```

Only one boot file should be executable.

### Too Many Helper Processes

Runit log subservices were useful on paper. On Android, each `log/run` service
adds another long-running child process.

In the failing state, the Termux process count was around `45`, and `runsvdir`
kept disappearing every few minutes. After moving ten `log` directories out of
the active service tree, the process count stayed around `31-32` during the
validation window and the Jellyfin/Navidrome/Samba PIDs stayed stable.

That does not prove Android's exact kill trigger. It does show the practical
rule for this phone: keep the service tree small.

## Install The Watchdog Pieces

From the repository checkout on the phone:

```sh
cd "$HOME/android-media-server"
mkdir -p "$HOME/bin" "$HOME/.termux/boot"

cp templates/bin/gateway-services-check "$HOME/bin/gateway-services-check"
cp templates/bin/runit-supervisor-watchdog "$HOME/bin/runit-supervisor-watchdog"
cp templates/boot/00-start-android-media-services \
  "$HOME/.termux/boot/00-start-android-media-services"

chmod 700 "$HOME/bin/gateway-services-check"
chmod 700 "$HOME/bin/runit-supervisor-watchdog"
chmod 700 "$HOME/.termux/boot/00-start-android-media-services"
chmod 600 "$HOME/.termux/boot"/*.bak* 2>/dev/null || true
```

Install the periodic checker service:

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/gateway-service-watch"
cp templates/services/gateway-service-watch/run \
  "$PREFIX/var/service/gateway-service-watch/run"
chmod +x "$PREFIX/var/service/gateway-service-watch/run"
```

Start or repair the service tree:

```sh
"$HOME/bin/runit-supervisor-watchdog"
"$HOME/bin/gateway-services-check"
sv up "$PREFIX/var/service/gateway-service-watch"
```

## Disable Runit Log Subservices

Use app-native logs and watchdog status first. Keep runit log subservices out of
the active tree unless you have a reason to spend the extra processes.

Move active `log` directories aside:

```sh
LOG_ARCHIVE="$PREFIX/var/service.logs-disabled/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_ARCHIVE"

for logdir in "$PREFIX"/var/service/*/log; do
  [ -d "$logdir" ] || continue
  svcdir=${logdir%/log}
  svc=${svcdir##*/}
  mv "$logdir" "$LOG_ARCHIVE/$svc.log"
done

"$HOME/bin/runit-supervisor-watchdog"
```

After this, active services may no longer write:

```text
$PREFIX/var/log/sv/<service>/current
```

Use the service's own logs, the dashboard, and the watchdog files instead.

## How Recovery Works

The checker handles the easy case itself:

| State | Action |
|---|---|
| no `runsvdir`, no old `runsv` | remove stale pidfile, start `service-daemon` |
| one clean `runsvdir` | enforce service policy |
| USB ready | start Jellyfin, Navidrome, Samba, FileBrowser, Audiobookshelf |
| USB missing | stop USB-dependent services |

For dangerous states, the checker does not rebuild the tree inside its own
runit process. It queues the external watchdog:

| State | Action |
|---|---|
| duplicate `runsvdir` | queue watchdog |
| orphaned `runsv` children | queue watchdog |
| recent recovery already queued | wait |

The watchdog recovery path is deliberately narrow:

1. take a lock; a second recovery exits while the first one is running
2. stop `service-daemon`
3. terminate the exact `runsvdir $PREFIX/var/service`
4. terminate old `runsv` children
5. terminate matching stale app processes for known services
6. remove the stale service-daemon pidfile
7. start `service-daemon`
8. run `gateway-services-check`
9. write `status.json`

It does not kill random processes. Stale app cleanup is limited to known
services and known command patterns.

## Check Health

Fast status:

```sh
"$HOME/bin/runit-supervisor-watchdog" --status
"$HOME/bin/gateway-services-check"
```

Read the JSON status used by the dashboard:

```sh
python3 -m json.tool "$HOME/.local/state/runit-supervisor-watchdog/status.json"
```

Check the process tree:

```sh
pgrep -af "^($PREFIX/bin/)?runsvdir $PREFIX/var/service$"
ps -A -o pid,ppid,args | grep -E 'runsvdir|runsv ' | grep -v grep
```

Healthy shape:

```text
runsvdir_count=1
orphan_runsv_count=0
```

The dashboard on port `8080` also reads the watchdog status file and shows a
compact supervisor state. See [[13 - Dashboard on Port 8080]].

## Manual Hard Recovery

Use the watchdog first:

```sh
"$HOME/bin/runit-supervisor-watchdog"
```

If the watchdog itself is missing or broken, use the same shape by hand:

```sh
service-daemon stop
pkill -f "^($PREFIX/bin/)?runsvdir $PREFIX/var/service$" 2>/dev/null || true
pkill -f "^runsv " 2>/dev/null || true
pkill -f "jellyfin --service --datadir $HOME/.local/share/jellyfin" 2>/dev/null || true
pkill -f "navidrome --configfile $HOME/.config/navidrome/navidrome.toml" 2>/dev/null || true
rm -f "$PREFIX/var/run/service-daemon.pid"
service-daemon start
sleep 5
"$HOME/bin/gateway-services-check"
```

If you do this over SSH, expect SSH to restart. Be ready to reconnect.

## Pitfalls

| Pitfall | Why it hurts | Fix |
|---|---|---|
| starting `service-daemon` while old `runsv` children exist | creates split-brain supervision | run `runit-supervisor-watchdog` |
| executable boot backups | Termux:Boot runs every executable file | keep only one executable boot script |
| broad `pkill jellyfin` in a service `run` file | the service can kill its own supervised process | keep stale app cleanup in the watchdog |
| too many `svlogd` children | Android may get aggressive with many child processes | disable runit log subservices |
| debugging Jellyfin first | the visible app may be only a symptom | check supervisor state first |
| stopping one service manually | gateway checker may start it again | pause `gateway-service-watch` during controlled tests |

## Related

- [[05 - Service Supervision]]
- [[06 - USB Media Storage]]
- [[13 - Dashboard on Port 8080]]
- [[14 - Daily Operations]]
- [[Troubleshooting#runit-split-brain]]
