const { app, Tray, nativeImage, Menu, ipcMain } = require('electron')
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

        const context = Menu.buildFromTemplate([
            {label: 'Show Me', click: () => this.showHide()},
            {label: 'Separator', type: 'separator'},
            {label: 'Reload', click: () => this.reloadWindow()},
            {label: 'Window Frame', type: 'checkbox', checked: settings.get('showWindowFrame', true), click: () => this.toggleWindowFrame()},
            {label: 'Quit', click: () => this.cleanupAndQuit()}
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
        this.mailController.toggleWindow();
    }

    reloadWindow() {
        this.mailController.reloadWindow()
    }

    toggleWindowFrame() {
        settings.set('showWindowFrame', !settings.get('showWindowFrame'))
        this.mailController.win.destroy()
        this.mailController.init()
    }

    cleanupAndQuit() {
        app.exit(0)
    }
}

module.exports = TrayController