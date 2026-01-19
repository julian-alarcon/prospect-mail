const { app } = require("electron");
const path = require("path");
const MailWindowController = require("./controller/mail-window-controller");
const TrayController = require("./controller/tray-controller");

// Set the app name to use kebab-case for config directory (avoids spaces in path)
// This must be set before app is ready
app.setPath("userData", path.join(app.getPath("appData"), "prospect-mail"));

// Set desktop name for proper notification handling on Linux
// This prevents the system from showing a separate "app is ready" notification
if (process.platform === "linux") {
  app.setDesktopName("Prospect Mail");
}

//Store commandline for global purpose
global.cmdLine = process.argv;

class ProspectMail {
  constructor() {
    this.mailController = null;
    this.trayController = null;
  }

  // init method, the entry point of the app
  init() {
    const lock = app.requestSingleInstanceLock();
    if (!lock) {
      app.quit();
    } else {
      app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (this.mailController) this.mailController.show();
      });

      this.initApp();
    }
  }

  // init the main app
  initApp() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on("ready", () => {
      this.createControllers();
    });
    // Quit when all windows are closed.
    app.on("window-all-closed", () => {
      // On macOS it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== "darwin" && !this.mailController) {
        app.quit();
      }
    });
  }

  createControllers() {
    this.mailController = new MailWindowController();
    this.trayController = new TrayController(this.mailController);
  }
}

new ProspectMail().init();
