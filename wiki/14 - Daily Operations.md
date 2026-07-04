# 14 - Daily Operations

This is the page for normal life after setup.

## One-Minute Health Check

From SSH:

```sh
sv status "$PREFIX/var/service/n20-home-dashboard"
sv status "$PREFIX/var/service/jellyfin"
sv status "$PREFIX/var/service/navidrome"
sv status "$PREFIX/var/service/smbd-android"
```

Check USB:

```sh
"$HOME/bin/usb-media-ready" && echo "USB ready"
```

Open the dashboard:

```text
http://android-media.local:8080/
```

## Restart One Service

```sh
sv restart "$PREFIX/var/service/n20-home-dashboard"
```

Replace the service name as needed.

> [!TIP]
> If the service immediately goes back down, check whether the gateway checker
> is enforcing state. See [[Troubleshooting#service-keeps-coming-back-or-going-down]].

## After Reboot

The gateway command in this section is installed in
[[15 - Watchdog and Recovery#install-the-watchdog-pieces]]. If you have not
completed that page yet, skip it and set up the watchdog next.

Check:

```sh
pgrep -af runsvdir
sv status "$PREFIX/var/service/n20-home-dashboard"
"$HOME/bin/gateway-services-check"
```

Then open the dashboard.

## After USB Reconnect

This also assumes the gateway checker from
[[15 - Watchdog and Recovery#install-the-watchdog-pieces]] is installed.

Run:

```sh
"$HOME/bin/usb-media-ready"
"$HOME/bin/gateway-services-check"
```

Then check Jellyfin, Samba, and the file portal.

> [!NOTE]
> After a USB reconnect, start with [[06 - USB Media Storage]] before changing
> individual service configs.

## What Good Looks Like

- dashboard loads on `:8080`
- SSH works on `:8022`
- Jellyfin loads on `:8096`
- Navidrome loads on `:4533`
- Samba accepts connections on `:1445`
- port `445` is closed
- USB readiness check passes
- no duplicate `runsvdir` trees

## Next

Set up the watchdog before you trust the box: [[15 - Watchdog and Recovery]].
