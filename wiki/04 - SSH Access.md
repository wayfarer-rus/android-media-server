# 04 - SSH Access

SSH is how you administer the phone without tapping around on the screen.

Termux normally uses port `8022` for SSH because Android apps cannot bind to
privileged port `22` without root.

## Install OpenSSH

```sh
pkg install openssh
```

Set a password temporarily if you need one for first login:

```sh
passwd
```

Start SSH:

```sh
LAN_IP="192.168.1.50"
sshd -p 8022 -o "ListenAddress=$LAN_IP"
```

Use the LAN IP found in [[03 - First Termux Setup#find-your-lan-ip]] if it is
different from the example.

From your laptop:

```sh
ssh -p 8022 <termux-user>@192.168.1.50
```

The Termux user is often the Android app user. You can check it on the phone:

```sh
whoami
```

> [!TIP]
> Once you can log in, switch to SSH keys. Password login is okay for a short
> bootstrap window, but keys are nicer and safer for daily admin.

## Add Your SSH Key

On your laptop, copy your public key:

```sh
cat ~/.ssh/id_ed25519.pub
```

In the SSH session:

```sh
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Paste the public key only.

Test from your laptop:

```sh
ssh -p 8022 <termux-user>@192.168.1.50
```

## Create Basic Directories

From this point on, prefer the SSH session for shell work. It keeps phone-screen
tapping to the Android permission prompts and battery settings.

```sh
mkdir -p "$HOME/bin"
mkdir -p "$HOME/.termux/boot"
mkdir -p "$HOME/.local/state/android-media-server"
```

## Next

Copy the project files onto the phone: [[04A - Project Files On The Phone]].
