const {
  app,
  dialog,
  Tray,
  nativeImage,
  Menu,
  ipcMain,
  shell,
} = require("electron");
const settings = require("../settings");
const path = require("path");
const fs = require("fs");
const { openAboutWindow } = require("./about-window");

const macOS = process.platform === "darwin";

class TrayController {
  constructor(mailController) {
    this.mailController = mailController;
    this.init();
  }

  init() {
    this.tray = new Tray(this.createTrayIcon(""));
    this.buildContextMenu();

    this.tray.on("click", () => this.fireClickEvent());

    ipcMain.on("updateUnread", (_event, value) => {
      this.tray.setImage(this.createTrayIcon(value));
    });
  }

  buildContextMenu() {
    const context = Menu.buildFromTemplate([
      { label: "Show", click: () => this.forceShow() },
      { label: "Reload", click: () => this.reloadWindow() },
      { type: "separator" },

      {
        label: "Settings",
        submenu: [
          {
            label: "Start Minimized",
            type: "checkbox",
            checked: settings.get("startMinimized"),
            click: () => this.toggleStartMinimized(),
          },
          { type: "separator" },
          {
            label: "Hide on Close",
            type: "checkbox",
            checked: settings.get("hideOnClose"),
            click: () => this.toggleHideOnClose(),
          },
          {
            label: "Hide on Minimize",
            type: "checkbox",
            checked: settings.get("hideOnMinimize"),
            click: () => this.toggleHideOnMinimize(),
          },
          {
            label: "Show Window Frame",
            type: "checkbox",
            checked: settings.get("showWindowFrame"),
            click: () => this.toggleWindowFrame(),
          },
          { type: "separator" },
          {
            label: "Show settings file",
            click: () => shell.showItemInFolder(path.resolve(settings.path)),
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
        click: () => openAboutWindow(),
      },
      { label: "Quit", click: () => this.cleanupAndQuit() },
    ]);

    this.tray.setContextMenu(context);
  }

  createTrayIcon(value) {
    const isUnread = Boolean(value);
    let iconPath;

    if (macOS) {
      iconPath = isUnread
        ? "../../assets/outlook_macOS_unread.png"
        : "../../assets/outlook_macOS.png";

      const trayIcon = nativeImage.createFromPath(
        path.join(__dirname, iconPath)
      );
      trayIcon.setTemplateImage(true);
      return trayIcon;
    }

    // For non-macOS platforms
    iconPath = isUnread
      ? "../../assets/outlook_linux_unread.png"
      : "../../assets/outlook_linux_black.png";

    return nativeImage.createFromPath(path.join(__dirname, iconPath));
  }

  fireClickEvent() {
    this.mailController.toggleWindow();
  }

  forceShow() {
    if (!this.mailController.win) return;

    if (!this.mailController.win.isVisible()) {
      this.mailController.toggleWindow();
    }
    this.mailController.win.show();
  }

  reloadWindow() {
    this.mailController.reloadWindow();
  }

  toggleStartMinimized() {
    let orivalue = settings.get("startMinimized");
    settings.set("startMinimized", !orivalue);
    this.buildContextMenu(); // Rebuild menu to reflect new checkbox state
  }
  toggleWindowFrame() {
    let orivalue = settings.get("showWindowFrame");
    settings.set("showWindowFrame", !orivalue);
    this.buildContextMenu(); // Rebuild menu to reflect new checkbox state
    global.preventAutoCloseApp = true;
    this.mailController.win.destroy();
    this.mailController.init();
  }
  toggleHideOnClose() {
    let orivalue = settings.get("hideOnClose");
    settings.set("hideOnClose", !orivalue);
    this.buildContextMenu(); // Rebuild menu to reflect new checkbox state
  }
  toggleHideOnMinimize() {
    let orivalue = settings.get("hideOnMinimize");
    settings.set("hideOnMinimize", !orivalue);
    this.buildContextMenu(); // Rebuild menu to reflect new checkbox state
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
            const settingsPath = settings.path;
            const backupPath = `${settingsPath}.bak-${Date.now()}`;
            fs.copyFileSync(settingsPath, backupPath);

            // Reset to defaults
            settings.clear();

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

      app.exit(0);
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
