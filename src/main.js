const { app } = require('electron')
const MailWindowController = require('./controller/mail-window-controller')
const TrayController = require('./controller/tray-controller')

class ElectronOutlook {
  constructor() {
    this.mailController = null;
    this.trayController = null;
  }

  // init method, the entry point of the app
  init() {
    const lock = app.requestSingleInstanceLock()
    if (!lock) {
      app.quit()
    } else {
      app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (this.mailController) this.mailController.show()
      })

      this.initApp()
    }
  }

  // init the main app
  initApp() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', () => {
      this.createControllers()
    })

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
      // On macOS it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== 'darwin' && !this.mailController) {
        app.quit()
      }
    })

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this.mailController === null) {
        this.createControllers()
      } else {
        this.mailController.show()
      }
    })
  }

  createControllers() {
    this.mailController = new MailWindowController()
    this.trayController = new TrayController(this.mailController)
  }
}

new ElectronOutlook().init()
