const { app, Tray, nativeImage, Menu, ipcMain } = require('electron');
const path = require('path');

const macOS = process.platform === 'darwin' ? true : false;

class TrayController {
    constructor(mailController) {
        this.mailController = mailController
        this.init()
    }

    init() {
        this.tray = new Tray(this.createTrayIcon(''))

        const context = Menu.buildFromTemplate([
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
        if (value) {
            iconPath = macOS ? '../../assets/outlook_macOS_unread.png' : '../../assets/outlook_linux_unread.png'
        } else {
            iconPath = macOS ? '../../assets/outlook_macOS.png' : '../../assets/outlook_linux_black.png'
        }
        return nativeImage.createFromPath(path.join(__dirname, iconPath))
    }

    fireClickEvent() {
        this.mailController.toggleWindow()
    }

    cleanupAndQuit() {
        app.exit(0)
    }
}

module.exports = TrayController