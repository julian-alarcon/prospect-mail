const { app, Tray, nativeImage, Menu, ipcMain, shell } = require('electron')
const settings = require('electron-settings')
const path = require('path')

const macOS = process.platform === 'darwin' ? true : false

class TrayController {
    constructor(mailController) {
        this.mailController = mailController
        this.init()
    }

    init() {
        this.tray = new Tray(this.createTrayIcon(''))
        //console.log('shell', shell)

        const context = Menu.buildFromTemplate([
            { label: 'Show Me', click: () => this.showHide() },
            { label: 'Separator', type: 'separator' },
            {
                label: 'Settings', submenu: [
                    { label: 'Window Frame', type: 'checkbox', checked: (settings.getSync('showWindowFrame') === undefined ? true : settings.getSync('showWindowFrame')), click: () => this.toggleWindowFrame() },
                    { label: 'Hide on Close', type: 'checkbox', checked: (settings.getSync('hideOnClose') === undefined ? true : settings.getSync('hideOnClose')), click: () => this.toggleWindowFrame() },
                    { label: 'Hide on Minimize', type: 'checkbox', checked: (settings.getSync('hideOnMinimize') === undefined ? true : settings.getSync('hideOnMinimize')), click: () => this.toggleWindowFrame() },
                    { label: 'Open settings file', click: () => shell.openPath(path.resolve(settings.file())) },
                    {
                        label: 'Reload settings file', click: () => {
                            this.mailController.win.destroy()
                            this.mailController.init()
                        }
                    },
                ]
            },
            { label: 'Quit', click: () => this.cleanupAndQuit() }
        ])

        this.tray.setContextMenu(context)

        this.tray.on('click', () => this.fireClickEvent())

        ipcMain.on('updateUnread', (event, value) => {
            this.tray.setImage(this.createTrayIcon(value))
        })
    }

    createTrayIcon(value) {

        let iconPath
        if (macOS) {
            iconPath = value ? '../../assets/outlook_macOS_unread.png' : '../../assets/outlook_macOS.png'
            let trayIcon = nativeImage.createFromPath(path.join(__dirname, iconPath))
            trayIcon.setTemplateImage(true)
            return trayIcon
        } else {
            iconPath = value ? '../../assets/outlook_linux_unread.png' : '../../assets/outlook_linux_black.png'
            return nativeImage.createFromPath(path.join(__dirname, iconPath))
        }
    }

    fireClickEvent() {
        this.mailController.toggleWindow()
    }

    showHide() {
        console.log("showHide: ", this.mailController.win.isVisible())
        this.mailController.toggleWindow();
    }

    toggleWindowFrame() {
        let orivalue = settings.getSync('showWindowFrame') === undefined ? true : settings.getSync('showWindowFrame')
        settings.setSync('showWindowFrame', !orivalue)
        this.mailController.win.destroy()
        this.mailController.init()
    }

    cleanupAndQuit() {
        app.exit(0)
    }
}

module.exports = TrayController