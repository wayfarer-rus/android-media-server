# Glossary

## Termux

An Android app that provides a Linux-like command-line environment without root.

## PREFIX

`$PREFIX` is Termux's package root. On a normal Termux install it is:

```text
/data/data/com.termux/files/usr
```

Termux binaries live under `$PREFIX/bin`, libraries under `$PREFIX/lib`, and
runit services under `$PREFIX/var/service`.

It is similar to `/usr` on a normal Linux system, but inside the Termux app's
private Android storage.

Check it with:

```sh
echo "$PREFIX"
```

## HOME

`$HOME` is the Termux user's home directory. On a normal Termux install it is:

```text
/data/data/com.termux/files/home
```

This guide keeps local scripts, service config, app state, and dashboard files
under `$HOME` unless they belong to Termux packages or runit service metadata.

## Termux:Boot

A Termux plugin that can run scripts when Android boots.

## Termux:API

An optional Termux plugin and package that expose some Android APIs to command
line tools. In this guide it is only nice-to-have dashboard status detail.

## runit

A small service supervisor. Termux uses it through `termux-services`.

## termux-services

Termux package that wires service management into Termux. It provides helpers
such as `sv-enable`, `sv-disable`, and service logging conventions.

## service

A long-running process managed by runit, such as Jellyfin, Samba, or the
dashboard.

## mDNS

Local network name discovery. This is how `android-media.local` can resolve to
the phone's LAN IP without public DNS.

## LAN

Local Area Network. Your home network.

## USB Volume ID

The folder name Android gives a mounted USB drive under `/mnt/media_rw/`.

## Samba

Open-source SMB file sharing. This is how the phone can appear as a network
drive.

## Jellyfin

Self-hosted video/media server.

## Navidrome

Self-hosted music server with Subsonic-compatible clients.

## Audiobookshelf

Self-hosted audiobook and podcast server.
