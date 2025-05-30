const { app, Tray, nativeImage, Menu, ipcMain, shell } = require("electron");
const settings = require("electron-settings");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { default: openAboutWindow } = require("about-window");
const about_iconPath = path.join(__dirname, "../../misc/prospect-logo.svg");
const packageJson = require("../../package.json");

const macOS = process.platform === "darwin" ? true : false;

class TrayController {
  constructor(mailController) {
    this.mailController = mailController;
    this.init();
  }

  init() {
    this.tray = new Tray(this.createTrayIcon(""));
    //console.log('shell', shell)

    const context = Menu.buildFromTemplate([
      { label: "Show", click: () => this.forceShow() },
      { label: "Reload", click: () => this.reloadWindow() },
      {
        label: "Settings",
        submenu: [
          {
            label: "Hide on Close",
            type: "checkbox",
            checked:
              settings.getSync("hideOnClose") === undefined
                ? true
                : settings.getSync("hideOnClose"),
            click: () => this.toggleHideOnClose(),
          },
          {
            label: "Hide on Minimize",
            type: "checkbox",
            checked:
              settings.getSync("hideOnMinimize") === undefined
                ? true
                : settings.getSync("hideOnMinimize"),
            click: () => this.toggleHideOnMinimize(),
          },
          {
            label: "Show Window Frame",
            type: "checkbox",
            checked:
              settings.getSync("showWindowFrame") === undefined
                ? true
                : settings.getSync("showWindowFrame"),
            click: () => this.toggleWindowFrame(),
          },
          {
            label: "Show settings file",
            click: () => shell.showItemInFolder(path.resolve(settings.file())),
          },
        ],
      },
      {
        label: "About this App",
        click: () =>
          openAboutWindow({
            icon_path: about_iconPath,
            product_name: "Prospect Mail",
            copyright: [
              `<p style="text-align: center">Distributed under ${packageJson.license} license</p>
                        <p style="text-align: center"><b>If this App has been useful for you,
                        </p><p style="text-align: center">consider buying me a coffee  ☕!</p>
                        <p style="text-align: center"><a href="https://github.com/sponsors/julian-alarcon" title="Donate using Ko-fe, PayPal or GitHub">Donate</a></p>`,
            ],
            use_version_info: false,
            use_inner_html: true,
            adjust_window_size: true,
          }),
      },
      { label: "Quit", click: () => this.cleanupAndQuit() },
    ]);

    this.tray.setContextMenu(context);

    this.tray.on("click", () => this.fireClickEvent());

    ipcMain.on("updateUnread", (event, value) => {
      this.tray.setImage(this.createTrayIcon(value));
    });
  }

  createTrayIcon(value) {
    let iconPath;
    if (macOS) {
      iconPath = value
        ? "../../assets/outlook_macOS_unread.png"
        : "../../assets/outlook_macOS.png";
      let trayIcon = nativeImage.createFromPath(path.join(__dirname, iconPath));
      trayIcon.setTemplateImage(true);
      return trayIcon;
    } else {
      iconPath = value
        ? "../../assets/outlook_linux_unread.png"
        : "../../assets/outlook_linux_black.png";
      return nativeImage.createFromPath(path.join(__dirname, iconPath));
    }
  }

  fireClickEvent() {
    this.mailController.toggleWindow();
  }

  forceShow() {
    if (!this.mailController.win.isVisible()) {
      this.mailController.toggleWindow();
    }
    this.mailController.win.show();
  }

  reloadWindow() {
    this.mailController.reloadWindow();
  }

  toggleWindowFrame() {
    let orivalue =
      settings.getSync("showWindowFrame") === undefined
        ? true
        : settings.getSync("showWindowFrame");
    settings.setSync("showWindowFrame", !orivalue);
    global.preventAutoCloseApp = true;
    this.mailController.win.destroy();
    this.mailController.init();
  }
  toggleHideOnClose() {
    let orivalue =
      settings.getSync("hideOnClose") === undefined
        ? true
        : settings.getSync("hideOnClose");
    settings.setSync("hideOnClose", !orivalue);
  }
  toggleHideOnMinimize() {
    let orivalue =
      settings.getSync("hideOnMinimize") === undefined
        ? true
        : settings.getSync("showWindowFrame");
    settings.setSync("hideOnMinimize", !orivalue);
  }

  cleanupAndQuit() {
    app.exit(0);
  }
}

module.exports = TrayController;
