# Prospect Mail

<img src="build/icon.png" alt="logo" height="80" align="center" />

[![Build & Release](https://github.com/julian-alarcon/prospect-mail/actions/workflows/build-release.yml/badge.svg)](https://github.com/julian-alarcon/prospect-mail/actions/workflows/build-release.yml)
[![Latest release](https://img.shields.io/github/v/release/julian-alarcon/prospect-mail)](https://github.com/julian-alarcon/prospect-mail/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/julian-alarcon/prospect-mail/total)](https://github.com/julian-alarcon/prospect-mail/releases)

Unofficial email Outlook client using Electron. It uses the
[Web App](https://www.microsoft.com/en-us/microsoft-365/outlook/web-email-login-for-outlook)
and wraps it as a standalone application using Electron. This only works for
Microsoft/Office 365 accounts, don't use it for personal Outlook.com accounts.

Available for Linux, Windows (10+) and macOS.

> This project has NO DIRECT AFFILIATION with Microsoft, Microsoft 365 or any
> product made by Microsoft.

## Download

The application can be downloaded from [here](https://github.com/julian-alarcon/prospect-mail/releases).

Select the appropriated file depending on your OS:

- Windows: `.exe` file or `.msi` file
- macOS: `.dmg` file
- Linux: Multiple artifacts are available, please choose your needed one
(AppImage, deb, pacman, rpm, snap, tar.gz) depending on your Linux
Distribution.

## Installation

### Windows

Just double click and follow the Installer steps.

### macOS

Double click the dmg file and drag the blue Prospect Mail icon to the App
folder

### Linux

Snap builds are available in the Snap Store.

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/prospect-mail)

Or use `sudo snap install prospect-mail` from the terminal.

Arch Linux has a community published artifact available in
[AUR here](https://aur.archlinux.org/packages/prospect-mail-bin/).

For other distributions please follow your specific steps.

## Screenshots

![screenshot-linux](misc/prospect-mail.png)

![screenshot-calendar-view](misc/calendar-view.png)

## Features

- Receive your Outlook Microsoft 365 online from the desktop app
- Close to minimize
- Start as minimized (you can use the Option in the Tray icon menu or start app
with `prospect-mail --minimized`)
- Dock tray support
- System notification
- Connect to standard or custom outlook url
- Spellcheck using native Outlook MS Editor

## Settings

Via tray menu settings.json can be opened and edited. After every save you
need to click in "Reload settings" to apply changes.

```json
{
 "mainMailServiceUrl":"https://customurl.example/",
 "deeplinkUrls":["customurl.example"],
 "mailServicesUrls":["mailServicesUrls.example"],
 "safelinksUrls": ["safelinksUrls.example"],
 "showWindowFrame":true
}
```

As an example, this configuration will let you use Prospect with personal
Outlook.com account:

> Please notice that Prospect Mail is only tested in Work/Educational accounts
> and no issues will be reviewed for personal accounts.

```json
{
  "mainMailServiceUrl": "https://login.live.com/login.srf",
  "deeplinkUrls": ["outlook.com", "live.com"],
  "mailServicesUrls": ["outlook.com", "live.com"]
}
```

### Architecture components

The main software architecture components and their versions are this:

- [Node.js](https://nodejs.org/en/about/previous-releases#release-schedule) version: 20.x LTS
- [yarn](https://yarnpkg.com/) version: 1.22.x or newer
- [electron](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) version: 27.x
- [electron-builder](https://www.electron.build/) version: 24.6.x
- [electron-settings](https://github.com/nathanbuchar/electron-settings)
  version: 4.0.2

## Build

Clone the repository and run in development mode. (You need to have
[git](https://git-scm.com/) , node and yarn) installed)

```sh
git clone https://github.com/julian-alarcon/prospect-mail.git
cd prospect-mail
yarn
yarn start
```

Build the application for linux

```sh
yarn run dist:linux
```

This will build an AppImage, deb and snap files in the dist folder. This files
can be run in most popular linux distributions.

Is possible to specify the snap or AppImage build type using running this:

```sh
yarn dist:linux:snap
```

Build the application for Mac (It works in versions 10.14 and 10.15)

```sh
yarn dist:mac
```

Build it for windows:

```sh
yarn dist:windows
```

### Install developer artifact

Once it was builded, or using the release files available, you can install the
files using [AppImage process](https://docs.appimage.org/user-guide/faq.html#question-how-do-i-run-an-appimage),
using .deb `sudo dpkg -i prospect-mail_x.y.z_arch.deb` or using the snap
file `sudo snap install prospect-mail_x.y.z_arch.snap --dangerous`.

## Release to Public

With the specific permissions on Github, to create a new release follow the
steps defined by [action-electron-builder](https://github.com/samuelmeuli/action-electron-builder)

1. Open Pull Request for new version
1. Define version in package.json. E.g. `1.0.0-beta2`

## Manual release to Snapstore

```sh
snapcraft login
snapcraft upload --release=edge prospect-mail_x.y.z_arch.snap
```

## License

[MIT](https://github.com/julian-alarcon/prospect-mail/blob/master/LICENSE) by
[Julian Alarcon](https://desentropia.com) based on
[electron-outlook](https://github.com/eNkru/electron-outlook) by
[Howard J](https://enkru.github.io/)
