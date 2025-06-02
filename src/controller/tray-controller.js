const {
  app,
  dialog,
  Tray,
  nativeImage,
  Menu,
  ipcMain,
  shell,
} = require("electron");
const settings = require("electron-settings");
const path = require("path");
const fs = require("fs");
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
      { type: "separator" },

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
          { type: "separator" },
          {
            label: "Show settings file",
            click: () => shell.showItemInFolder(path.resolve(settings.file())),
          },
          {
            label: "Restore Default Settings", // previously "Reset configuration"
            click: () => this.restoreDefaultSettings(),
          },
          {
            label: "Reset Application Data", // previously "Fully reset"
            click: () => this.confirmFullReset(),
          },
        ],
      },

      { type: "separator" },
      {
        label: "About Prospect Mail",
        click: () =>
          openAboutWindow({
            icon_path: about_iconPath,
            product_name: "Prospect Mail",
            copyright: [
              `
              <p style="text-align: center">Distributed under ${packageJson.license} license</p>
              <p style="text-align: center"><b>If this App has been useful for you,</p>
              <p style="text-align: center">consider buying me a coffee  ☕!</p>
              <p style="text-align: center"><a href="https://github.com/sponsors/julian-alarcon" title="DONATE using Ko-fe, PayPal or GitHub">Donate</a></p>
              `,
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

  restoreDefaultSettings() {
    dialog
      .showMessageBox({
        type: "warning",
        buttons: ["Cancel", "Restore settings"],
        defaultId: 1,
        cancelId: 0,
        title: "Confirm Restore Settings",
        message: "Restore all settings to default values?",
        detail:
          "This will restore all settings to their factory defaults but preserve your app data.",
      })
      .then(({ response }) => {
        if (response === 1) {
          try {
            // Create backup of current settings
            const settingsPath = settings.file();
            const backupPath = `${settingsPath}.bak-${Date.now()}`;
            fs.copyFileSync(settingsPath, backupPath);

            // Reset to defaults
            settings.setSync({});

            // Relaunch application
            app.relaunch();
            app.exit(0);
          } catch (error) {
            dialog.showErrorBox(
              "Restore Failed",
              `Could not Restore settings: ${error.message}`
            );
          }
        }
      });
  }

  // NEW METHOD: Full application reset (Node.js 22+ optimized)
  async confirmFullReset() {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Cancel", "Reset Everything"],
      defaultId: 1,
      cancelId: 0,
      title: "Confirm Full Reset",
      message: "Clear ALL application data?",
      detail:
        "This will permanently delete:\n- All settings\n- Cached emails\n- Local data\n\nThe application will quit after completion and you will need to re-enter your login information.",
    });

    if (response !== 1) return;

    const userDataPath = app.getPath("userData");
    console.log(`Deleting user data at: ${userDataPath}`);

    try {
      await fs.promises.rm(userDataPath, { recursive: true, force: true });

      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        title: "Reset Complete",
        message: "All app data has been deleted.",
        detail: "The application will now close.",
      });

      app.exit(0);;
    } catch (error) {
      await dialog.showErrorBox(
        "Reset Failed",
        `Could not clear app data:\n${error.message}`
      );
    }
  }

  cleanupAndQuit() {
    app.exit(0);
  }
}

module.exports = TrayController;
