# Prospect Mail client

<img src="build/icon.png" alt="logo" height="80" align="center" />

[![builds](https://github.com/julian-alarcon/prospect-mail/actions/workflows/release.yml/badge.svg)](https://github.com/julian-alarcon/prospect-mail/actions)
[![releases](https://badgen.net/github/release/julian-alarcon/prospect-mail/)](https://github.com/julian-alarcon/prospect-mail/releases/latest)

The Outlook desktop client for the
[new Outlook Interface](https://www.microsoft.com/en-us/microsoft-365/blog/2018/06/13/power-and-simplicity-updates-to-the-office-365-user-experience/)
from Microsoft 365.

Available for Linux , Windows and macOS.

## Download

The application can be downloaded from [here](https://github.com/julian-alarcon/prospect-mail/releases).

Select the appropriated file depending on your OS:

* Windows: `.exe` file or `.msi` file
* macOS: `.dmg` file
* Linux: Multiple artifacts are available, please choose your needed one (deb,
rpm, AppImage, snap, pacman) depending on your Linux Distribution.

## Installation

### Windows

Just double click and follow the Installer steps.

### macOS

Double click the dmg file and drag the blue Prospect Mail icon to the App folder

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

## Needed configuration in your Outlook Web configuration

> It's recommended to enable the new design to be able to use this client

## Features

* Receive your Outlook Microsoft 365 online from the desktop app
* Close to minimize
* Start as minimized (you can use the Option in the Tray icon menu or start app with `prospect-mail --minimized`)
* Dock tray support
* System notification
* Connect to standard or custom outlook url
* Spellcheck using native Outlook MS Editor

## Settings

* Via tray menu settings.json can be opened and edited. After every save you
need to click in "Reload settings" to apply changes.

```json
{
 "urlMainWindow":"https://customurl.example/"
 ,"urlsInternal":["customurl.example"]
 ,"urlsExternal":["externalurls.example"]
 ,"showWindowFrame":true
}
```

As an example, this configuration will let you use Prospect with personal
Outlook.com account:

> Please notice that Prospect Mail is only tested in Work/Educational accounts
and no issues will be reviewed for personal accounts.

```json
{
    "urlMainWindow":"https://outlook.live.com/mail",
    "urlsInternal":["outlook.com", "live.com"],
    "urlsExternal":["outlook.com", "live.com"]
}
```

### Architecture components

The main software architecture components and their versions are this:

* [Node.js](https://nodejs.org/en/) version: 20.x
* [yarn](https://yarnpkg.com/) version: 1.22.x or newer
* [electron](http://electronjs.org/) version: 25.x
* [electron-builder](https://www.electron.build/) version: 24.6.x
* [electron-settings](https://github.com/nathanbuchar/electron-settings)
version: 4.0.2

## Build

Clone the repository and run in development mode. (You need to have
[git](https://git-scm.com/) , node and yarn) installed)

```bash
git clone https://github.com/julian-alarcon/prospect-mail.git
cd prospect-mail
yarn
yarn start
```

Build the application for linux

```bash
yarn run dist:linux
```

This will build an AppImage, deb and snap files in the dist folder. This files
can be run in most popular linux distributions.

Is possible to specify the snap or AppImage build type using running this:

```bash
yarn run dist:linux:snap
```

Build the application for Mac (It works in versions 10.14 and 10.15)

```bash
yarn run dist:mac
```

### Install developer artifact

Once it was builded, or using the release files available, you can install the
files using [AppImage process](https://docs.appimage.org/user-guide/faq.html#question-how-do-i-run-an-appimage),
using .deb ```sudo dpkg -i prospect-mail_x.y.z_arch.deb``` or using the snap
file ```sudo snap install prospect-mail_x.y.z_arch.snap --dangerous```.

## Release to Public

With the specific permissions on Github, to create a new release follow the
steps defined by [action-electron-builder](https://github.com/samuelmeuli/action-electron-builder)

1. Define version in package.json. E.g. `0.4.0`
1. Add commit with changes. E.g. `git commit -am v0.4.0`
1. Tag the commit. E.g. `git tag v0.4.0`. Don't forget the `v` as suffix of the
version.
1. Push changes including tags `git push && git push --tags`

## Manual release to Snapstore

```sh
snapcraft login
snapcraft upload --release=edge prospect-mail_x.y.z_arch.snap
```

## License

[MIT](https://github.com/julian-alarcon/prospect-mail/blob/master/LICENSE) by
[Julian Alarcon](https://desentropia.com) based on work on
[electron-outlook](https://github.com/eNkru/electron-outlook) by
[Howard J](https://enkru.github.io/)
