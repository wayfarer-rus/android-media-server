# 04A - Project Files On The Phone

The service pages copy scripts and configs from this repository. Put the
repository on the phone once, then run later `cp templates/...` commands from
that directory.

## Prerequisites

Finish [[04 - SSH Access]] first. The rest of the guide is much easier from a
laptop keyboard.

The examples below use:

```text
$HOME/android-media-server
```

as the project directory on the phone.

## Clone With Git

From the SSH session on the phone:

```sh
cd "$HOME"
REPO_URL="https://github.com/<owner>/android-media-server.git"
git clone "$REPO_URL" android-media-server
cd "$HOME/android-media-server"
```

Replace `<owner>` with the GitHub account or organization that hosts the
repository.

Check that the files used by later pages are present:

```sh
test -r templates/bin/usb-media-ready
test -r templates/services/sshd/run
test -r services/n20-home-dashboard/server/n20-dashboard-server.py
echo "project files ready"
```

## Use A Zip Archive

If you do not want Git on the phone, download the repository archive instead:

```sh
cd "$HOME"
curl -L -o android-media-server.zip \
  "https://github.com/<owner>/android-media-server/archive/refs/heads/main.zip"
unzip android-media-server.zip
mv android-media-server-main android-media-server
cd "$HOME/android-media-server"
```

The directory name inside the zip may differ if the default branch is not
`main`. Rename it to `android-media-server` so the rest of the guide stays
predictable.

## Working Directory Rule

Before installing any template, return to the repository:

```sh
cd "$HOME/android-media-server"
```

If a command fails with:

```text
cp: cannot stat 'templates/...'
```

the shell is in the wrong directory or the project files were not copied to the
phone. Run:

```sh
pwd
ls templates
```

and fix the directory before continuing.

## Keep Private Files Out

This repository should contain templates and guide text only. Keep local
passwords, media titles, live logs, app databases, and one-off notes outside the
project directory. See [[Security#public-repo-hygiene]].

## Next

Put SSH under runit in [[04B - SSH Runit Service]].
