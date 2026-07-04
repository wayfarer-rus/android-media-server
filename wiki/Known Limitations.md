# Known Limitations

This setup works because it respects the limits instead of fighting all of
them.

## No Root

Without root:

- privileged ports like `80`, `22`, and `445` are not the normal path
- some `/proc`, `/sys`, and network counters are unavailable
- raw block device tools may fail
- some Android mount details are hidden

So the guide uses:

- dashboard on `8080`
- SSH on `8022`
- Samba on `1445`
- practical status details instead of full system metrics

## Android Background Limits

Android may kill background work. It may also leave stale processes behind after
partial failures.

The answer is [[05 - Service Supervision]], not more random startup scripts.

## USB Behavior

USB drives can disappear during sleep, cable movement, hub trouble, or Android
storage permission changes.

Services that depend on USB should wait for [[06 - USB Media Storage]].

## mDNS Is Not Universal

`.local` names usually work well on Apple devices and many Linux systems.
Windows behavior varies.

Direct IP fallback:

```text
http://192.168.1.50:8080/
```

## Samba Port 1445

Some clients expect SMB on port `445` and make custom ports awkward.

This guide still uses `1445` because it works without root and keeps the setup
honest about what a non-rooted phone can bind.

## Termux:API Is Optional

Termux:API can hang or return nothing on some devices or contexts. The dashboard
must tolerate that.

The media server should not require Termux:API.

## Audiobookshelf Is The Hardest Service

Native Node builds on Android can be fragile.

The scanner is the main runtime risk. It can make the phone feel overloaded and
can degrade the other services while it walks and probes the audiobook library.

Get the rest of the server stable first, then add Audiobookshelf. Keep watcher
and automatic scans disabled, and run manual scans only when the phone is quiet.

## GitHub Wiki Search

GitHub wikis are convenient for a guide like this. If public search traffic
matters later, mirror the guide to GitHub Pages instead of making the wiki do
everything.
