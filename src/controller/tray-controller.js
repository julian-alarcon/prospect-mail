const { app, Tray, nativeImage, Menu, ipcMain, shell, dialog } = require('electron')
const debug = require('electron-debug');
const settings = require('electron-settings')
const path = require('path')

const macOS = process.platform === 'darwin' ? true : false

debug();

class TrayController {
    constructor(mailController) {
        this.mailController = mailController
        this.init()
    }

    init() {
        this.tray = new Tray(this.createTrayIcon(''))
        //console.log('shell', shell)

        const context = Menu.buildFromTemplate([
            { label: 'Reload', click: () => this.reloadWindow()},
            {
                label: 'Settings', submenu: [
                    { 
                        label: 'Hide on Close', 
                        type: 'checkbox', 
                        checked: (this.getConfigurationItem('hideOnClose', true)), 
                        click: (menuItem, browserWindow, event) => {
                            let val = menuItem.checked
                            this.setConfigurationItem('hideOnClose', val)
                                .then(() => { this.toggleWindowFrame() })
                        }
                    },
                    { 
                        label: 'Hide on Minimize', 
                        type: 'checkbox', 
                        checked: (this.getConfigurationItem('hideOnMinimize', true)),
                        click: (menuItem, browserWindow, event) => {
                            let val = menuItem.checked
                            this.setConfigurationItem('hideOnMinimize', val)
                                .then(() => { this.toggleWindowFrame() })
                        }
                    },
                    { 
                        label: 'Show Window Frame', 
                        type: 'checkbox', 
                        checked: (this.getConfigurationItem('showWindowFrame', true)),
                        click: (menuItem, browserWindow, event) => {
                            let val = menuItem.checked
                            this.setConfigurationItem('showWindowFrame', val)
                                .then(() => { this.toggleWindowFrame() })
                        }
                    },
                    {
                        label: 'Show settings file', click: () => shell.showItemInFolder(path.resolve(settings.file()))
                    }
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

    getConfigurationItem(flag, defaultValue = true) {
        let val = settings.getSync(flag)
        // When inexistent, true prevalence.
        return (val === undefined ? defaultValue : val)
    }

    // Stores configuration on file.
    async setConfigurationItem(flag, value) {
        await settings.set(flag, value)
        let val = await settings.get(flag)
        return val
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
        this.mailController.win.destroy()
        this.mailController.init()
    }

    cleanupAndQuit() {
        app.exit(0)
    }
}

module.exports = TrayController