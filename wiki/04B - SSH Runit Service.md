# 04B - SSH Runit Service

This page promotes the bootstrap SSH daemon into a supervised runit service.
The dashboard and watchdog expect a service named `sshd`.

## Prerequisites

Finish:

- [[04 - SSH Access]]
- [[04A - Project Files On The Phone]]

The commands below assume:

```sh
cd "$HOME/android-media-server"
```

## Start Runit

`termux-services` starts `runsvdir` when a new Termux session opens. After
installing `termux-services`, close and reopen Termux once. If you are already
using SSH, disconnect and reconnect after reopening Termux on the phone.

Check it:

```sh
pgrep -af runsvdir
```

If that prints nothing, open a fresh Termux session before continuing.

## Install The Service

```sh
cd "$HOME/android-media-server"
mkdir -p "$PREFIX/var/service/sshd"
cp templates/services/sshd/run "$PREFIX/var/service/sshd/run"
chmod +x "$PREFIX/var/service/sshd/run"
nano "$PREFIX/var/service/sshd/run"
```

In the copied file, change the `192.168.1.50` default in the `LISTEN_ADDRESS`
line if the phone uses another LAN IP.

If the first one-off `sshd` is still listening, stop only the listener before
starting the supervised one:

```sh
if [ -r "$PREFIX/var/run/sshd.pid" ]; then
  kill "$(cat "$PREFIX/var/run/sshd.pid")" 2>/dev/null || true
fi
sv up "$PREFIX/var/service/sshd"
sv status "$PREFIX/var/service/sshd"
```

The existing SSH session should normally stay alive because the command stops
the listener, not the login shell. If the session drops, open Termux on the
phone and run `sshd` once, then reconnect and inspect
[[Troubleshooting#ssh-unreachable]].

## Validate

From the laptop:

```sh
ssh -p 8022 <termux-user>@192.168.1.50 'echo ssh-ok'
```

From the phone:

```sh
sv status "$PREFIX/var/service/sshd"
timeout 3 sh -c '</dev/tcp/127.0.0.1/8022' && echo "8022 open"
```

## Next

Build the rest of the service model in [[05 - Service Supervision]].
