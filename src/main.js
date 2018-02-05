const { app } = require('electron')
const MailController = require('./controller/mail-window-controller')
const TrayController = require('./controller/tray-controller')

class ElectronOutlook {
  constructor() {
    this.mailController = null;
    this.trayController = null;
  }

  // init method, the entry point of the app
  init() {
    if (this.isRunning()) {
      app.quit()
    } else {
      this.initApp()
    }
  }

  // check if the app is already running. return true if already launched, otherwise return false.
  isRunning() {
    return app.makeSingleInstance(() => {
      if (this.mailController) this.mailController.show();
    });
  }

  // init the main app
  initApp() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', this.createControllers)

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
      // On macOS it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this.mailController === null) {
        createControllers()
      } else {
        this.mailController.show()
      }
    })
  }

  createControllers() {
    this.mailController = new MailController()
    this.trayController = new TrayController(this.mailController)
  }
}

new ElectronOutlook().init()
