# 05 - Service Supervision

This is the backbone of the whole setup.

On a desktop Linux server, you might install a service and expect it to keep
running until the machine reboots. Android is different. It is designed to save
battery, manage apps, and keep the phone responsive. If background processes
look too busy or too numerous, Android may kill them. Sometimes it kills the
obvious thing. Sometimes it leaves enough behind that the next start gets messy.

So we keep the service model simple.

## The Shape We Want

- `termux-services` provides runit
- long-running apps live under `$PREFIX/var/service`
- one boot script starts the service manager
- one gateway checker decides which services should be up
- USB-dependent services wait for [[06 - USB Media Storage]]
- the watchdog repairs broken supervision instead of starting a second service
  tree beside the first one

> [!NOTE]
> If `sv status` disagrees with open ports or visible processes, check
> [[Troubleshooting#runit-split-brain]] before changing service files.

## Check Runit

By now [[04B - SSH Runit Service]] should have proved that `runsvdir` is alive.
Check it again before adding USB-dependent services:

```sh
pgrep -af runsvdir
```

If that prints nothing, open a fresh Termux session and return to
[[04B - SSH Runit Service#start-runit]].

## Start Policy

This section defines which services should be running at each stage. Runit keeps
processes alive; the gateway checker decides whether a service should be allowed
to start at all.

| Service group | Start when | Why |
|---|---|---|
| SSH, dashboard, mDNS | Termux starts | They let you reach and inspect the phone |
| USB readiness checker | before media services | It proves the drive path is mounted and readable |
| Jellyfin, Samba, Navidrome, Audiobookshelf, file portal | after USB is ready | They depend on real media folders |
| Watchdog or gateway repair | when supervision looks damaged | It cleans up stale runit or app processes |

Android is quick to stop background work that looks too busy, especially when
USB storage appears, disappears, and appears again. If every media app starts at
boot and retries forever, stale processes can keep ports open while runit thinks
the service is down.

The policy is therefore simple:

1. start the small LAN helpers first
2. test USB storage
3. start media services only when their folders exist
4. stop USB-dependent services when the drive disappears
5. repair damaged supervision through the watchdog/checker path

> [!TIP]
> When Jellyfin, Samba, or the file portal all fail at once, check
> [[06 - USB Media Storage]] before debugging each app separately.

## Daily Commands

```sh
sv status "$PREFIX/var/service/n20-home-dashboard"
sv status "$PREFIX/var/service/sshd"
sv status "$PREFIX/var/service/jellyfin"
sv status "$PREFIX/var/service/smbd-android"
sv status "$PREFIX/var/service/navidrome"
```

Restart one service:

```sh
sv restart "$PREFIX/var/service/n20-home-dashboard"
```

After [[15 - Watchdog and Recovery#install-the-watchdog-pieces]], run the
gateway check:

```sh
"$HOME/bin/gateway-services-check"
```

Before page 15, this command is not installed yet. Use the `sv status` commands
above and the USB checker from [[06 - USB Media Storage]].

> [!TIP]
> If a service comes back up and then goes down again, the gateway checker may
> be enforcing policy. See [[Troubleshooting#service-keeps-coming-back-or-going-down]].

## Next

The full recovery design is in [[15 - Watchdog and Recovery]]. Set up storage
next: [[06 - USB Media Storage]].
