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
const appIcon = require("../app-icon");
const path = require("path");
const fs = require("fs");
const { openAboutWindow } = require("./about-window");

// Electron is pinned to 42.x (Chromium 148) in package.json. Electron 43+ changed
// the tray D-Bus path/name in ways snapd's unity7 AppArmor template denies, so the
// strict snap tray icon never renders. Chromium <=148 uses the whitelisted path.
// Do NOT bump past 42.x until snapd 2.78 ships the fix. Details: issue #420.
class TrayController {
  constructor(mailController) {
    this.mailController = mailController;
    this.init();
  }

  init() {
    this.tray = new Tray(this.createTrayIcon(""));
    this.buildContextMenu();
    this.lastUnread = "";

    this.tray.on("click", () => this.fireClickEvent());

    ipcMain.on("updateUnread", (_event, value) => {
      // Skip redundant setImage calls: each one makes Chromium write a new temp
      // icon dir and emit NewIcon, which on Wayland/appindicator races the SNI
      // host and blanks the tray icon. Only redraw when the state changed.
      const isUnread = Boolean(value);
      if (isUnread === Boolean(this.lastUnread)) return;
      this.lastUnread = value;
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
          // Startup state is a single choice, so use a radio group: normal,
          // minimized, or maximized. This makes the mutual exclusivity explicit
          // (you can't be both minimized and maximized).
          {
            label: "Start Normal",
            type: "radio",
            checked: settings.get("startupWindowState") === "normal",
            click: () => this.setStartupState("normal"),
          },
          {
            label: "Start Minimized",
            type: "radio",
            checked: settings.get("startupWindowState") === "minimized",
            click: () => this.setStartupState("minimized"),
          },
          {
            label: "Start Maximized",
            type: "radio",
            checked: settings.get("startupWindowState") === "maximized",
            click: () => this.setStartupState("maximized"),
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
            // Positive phrasing: checked = notifications on.
            label: "Unread Message Notifications",
            type: "checkbox",
            checked: settings.get("showUnreadNotifications"),
            click: () => this.toggleUnreadNotifications(),
          },
          { type: "separator" },
          {
            label: "Show Settings File",
            click: () => shell.showItemInFolder(path.resolve(settings.path)),
          },
          {
            // Trailing ellipsis (HIG convention): opens a confirmation dialog.
            label: "Restore Default Settings…", // previously "Reset configuration"
            click: () => this.restoreDefaultSettings(),
          },
          {
            label: "Reset Application Data…", // previously "Fully reset"
            click: () => this.confirmFullReset(),
          },
        ],
      },

      {
        label: "App Icon",
        submenu: [
          {
            // Trailing ellipsis (HIG convention): opens a file picker.
            label: "Choose App Icon…",
            click: () => this.chooseAppIcon(),
          },
          {
            label: "Reset to Default Icon",
            enabled: appIcon.hasCustomIcon(),
            click: () => this.resetAppIcon(),
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
    return appIcon.getTrayIcon(Boolean(value));
  }

  /**
   * Lets the user pick a PNG to use as the app icon, replacing the bundled
   * tray, window and dock icons.
   */
  chooseAppIcon() {
    const parentWindow = this.mailController.win;
    const result = dialog.showOpenDialogSync(parentWindow, {
      title: "Choose App Icon",
      filters: [{ name: "Images", extensions: ["png"] }],
      properties: ["openFile"],
    });
    if (!result || result.length === 0) return;

    const selectedPath = result[0];
    // Reject anything Electron cannot decode before storing it, so a bad pick
    // can never leave the tray without an icon.
    if (nativeImage.createFromPath(selectedPath).isEmpty()) {
      dialog.showMessageBoxSync(parentWindow, {
        type: "error",
        title: "Choose App Icon",
        message: "That file could not be read as an image.",
        detail: selectedPath,
      });
      return;
    }

    settings.set("appIcon", selectedPath);
    this.applyAppIcon();
  }

  resetAppIcon() {
    settings.set("appIcon", "");
    this.applyAppIcon();
  }

  applyAppIcon() {
    this.tray.setImage(this.createTrayIcon(this.lastUnread));
    this.mailController.updateAppIcon();
    // Rebuild so "Reset to Default Icon" reflects the new state
    this.buildContextMenu();
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

  setStartupState(state) {
    // "normal" | "minimized" | "maximized"
    settings.set("startupWindowState", state);
    this.buildContextMenu(); // Rebuild menu to reflect new radio state
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
  toggleUnreadNotifications() {
    let orivalue = settings.get("showUnreadNotifications");
    settings.set("showUnreadNotifications", !orivalue);
    this.buildContextMenu(); // Rebuild menu to reflect new checkbox state
    // Reload the window so the observer picks up the new setting
    this.mailController.reloadWindow();
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
