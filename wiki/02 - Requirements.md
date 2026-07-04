# 02 - Requirements

This page is the shopping list and preflight check.

## Hardware

You need:

- Samsung Note 20
- reliable charger
- USB-C hub or USB-C storage adapter
- USB storage drive formatted as exFAT
- stable home Wi-Fi
- another computer for setup, such as a laptop

Nice to have:

- router DHCP reservation for the phone
- small phone stand
- powered USB hub if the drive needs more power than the phone wants to give

> [!TIP]
> A DHCP reservation is worth doing. The examples use `192.168.1.50`; your
> router can reserve whatever LAN IP your phone actually receives.

> [!NOTE]
> The stock USB checker in this repository accepts Android mounts reported as
> `exfat` or `sdfat`. Format the drive as exFAT for the first build. If you use
> another filesystem later, update [[06 - USB Media Storage#a-tiny-checker]] and
> test the new mount type before enabling media services.

## Android Apps

Install Termux from F-Droid. Install every Termux plugin used by this guide from
F-Droid as well. Mixing Termux and plugin builds from different app sources can
turn the first step into an Android package-signature problem before the server
setup has even started.

Install:

- Termux
- Termux:Boot
- optional: Termux:API

> [!WARNING]
> Use the F-Droid builds for `Termux`, `Termux:Boot`, and `Termux:API`.

If you need project release notes or app-specific details later, use
[[Upstream Links]]. They are optional during the first pass.

## Termux Packages

The exact package set depends on which services you install, but this is a good
starting point:

```sh
pkg update
pkg upgrade
pkg install openssh termux-services python git curl jq ripgrep nano unzip
pkg install samba
```

Later service pages add their own packages.

Install the `termux-api` package only if you also installed the Termux:API app
and want optional dashboard battery or Wi-Fi fields.

## Network Values

Pick your values now:

| Setting | Example | Notes |
|---|---|---|
| Phone LAN IP | `192.168.1.50` | Reserve this in your router if possible |
| Friendly name | `android-media.local` | Provided by mDNS |
| Samba user | `media-home` | Authenticated access |
| Samba share | `media-drive` | Points at the USB drive |

> [!TIP]
> Keep these values in a small local note while building. You will paste them
> into several pages: [[07 - Friendly LAN Name]], [[11 - Samba File Sharing]],
> and [[13 - Dashboard on Port 8080]].

## Media Layout

On the USB drive, use simple top-level folders:

```text
Movies/
Shows/
Music/
Audiobooks/
Podcasts/
```

This is not mandatory, but it makes every service easier to explain.

## Next

Move on to [[03 - First Termux Setup]].
