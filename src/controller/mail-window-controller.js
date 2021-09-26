const { app, BrowserWindow, shell, ipcMain, Notification } = require('electron')
const settings = require('electron-settings')
const CssInjector = require('../js/css-injector')
const JsInjector = require('../js/js-injector')
const path = require('path')

let outlookUrl
let deeplinkUrls
let outlookUrls
let showWindowFrame
let $this

class MailWindowController {
    constructor() {
        $this = this
        this.init()
    }
    reloadSettings() {
        // Get configurations.
        showWindowFrame = (settings.getSync('showWindowFrame') === undefined) ? true : settings.getSync('showWindowFrame')
        outlookUrl = settings.getSync('urlMainWindow') || 'https://outlook.office.com/mail'
        deeplinkUrls = settings.getSync('urlsInternal') || ['to-do.office.com/tasks', 'outlook.live.com/mail/deeplink', 'outlook.office365.com/mail/deeplink', 'outlook.office.com/mail/deeplink', 'outlook.office.com/calendar/deeplink']
        outlookUrls = settings.getSync('urlsExternal') || ['outlook.live.com', 'outlook.office365.com', 'outlook.office.com']
    }

    init() {
        this.reloadSettings()

        // Create the browser window.
        this.win = new BrowserWindow({
            x: 100,
            y: 100,
            width: 1400,
            height: 900,
            frame: showWindowFrame,
            transparent: !showWindowFrame,
            autoHideMenuBar: true,

            show: false,
            title: 'Prospect Mail',
            icon: path.join(__dirname, '../../assets/outlook_linux_black.png'),
            webPreferences: {
                spellcheck: true,
                nativeWindowOpen: true,
                nodeIntegration: true,
                contextIsolation: false,
                backgroundColor: 'transparent',
                affinity: 'main-window'
            }
        })

        // and load the index.html of the app.
        this.win.loadURL(outlookUrl)

        // Show window handler
        ipcMain.on('show', (event) => {
            this.show()
        })

        // Show Notfications (instead of HTML5)
        ipcMain.on('unread-messages-notification', (event, arg) => {
            let notification = new Notification(arg);
            notification.show();
        })

        // insert styles
        this.win.webContents.on('dom-ready', () => {
            this.win.webContents.insertCSS(CssInjector.main)
            let that = this
            if (!showWindowFrame) {
                let a = this.win.webContents.insertCSS(CssInjector.noFrame)
                a.then(() => {
                    // Add unread Messages Notification reader
                    that.addUnreadNumberObserver()
                    that.win.show()
                })
                .catch((err) => { 
                    console.log('Error CSS Insertion:', err)
                })
            } else {
                this.win.show()
            }
        })

        // prevent the app quit, hide the window instead.
        this.win.on('close', (e) => {
            //console.log('Log invoked: ' + this.win.isVisible())
            if (this.win.isVisible()) {
                if (settings.getSync('hideOnClose') === undefined ? true : settings.getSync('hideOnClose')) {
                    e.preventDefault()
                    this.win.hide()
                } else {
                    // Close the app
                    app.exit()
                }
            }
        })

        this.win.webContents.on('did-create-window', (childWindow) => {
            // insert styles
            childWindow.webContents.on('dom-ready', () => {
                childWindow.webContents.insertCSS(CssInjector.main)

                let that = this
                if (!showWindowFrame) {
                    let a = childWindow.webContents.insertCSS(CssInjector.noFrame)
                    a.then(() => {
                        childWindow.webContents.executeJavaScript(JsInjector.childWindow)
                            .then(() => {
                                childWindow.show()
                            })
                            .catch((errJS) => {
                                console.log('Error JS Insertion:', errJS)        
                            })
                    })
                    .catch((err) => { 
                        console.log('Error CSS Insertion:', err)
                    })
                }
            })
        })

        // prevent the app minimze, hide the window instead.
        this.win.on('minimize', (e) => {
            if (settings.getSync('hideOnMinimize') === undefined ? true : settings.getSync('hideOnMinimize')) {
                e.preventDefault()
                this.win.hide()
            } 
        })

        // Emitted when the window is closed.
        this.win.on('closed', () => {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            this.win = null
        })

        // Open the new window in external browser
        this.win.webContents.on('new-window', this.openInBrowser)
    }

    // Adds observer for the unread messages.
    addUnreadNumberObserver() {
        this.win.webContents.executeJavaScript(JsInjector.main)
    }

    // Toggles Window
    toggleWindow() {
        if (this.win.isVisible()) {
            this.win.hide()
        } else {
            this.show()
        }
    }
    reloadWindow() {
        this.win.reload()
    }

    openInBrowser(e, url, frameName, disposition, options) {
        console.log('Open in browser: ' + url)//frameName,disposition,options)
        if (new RegExp(deeplinkUrls.join('|')).test(url)) {
            // Default action - if the user wants to open mail in a new window - let them.
            options.webPreferences.affinity = 'main-window';
        }
        else if (new RegExp(outlookUrls.join('|')).test(url)) {
            // Open calendar, contacts and tasks in the same window
            e.preventDefault()
            this.loadURL(url)
        }
        else {
            // Send everything else to the browser
            e.preventDefault()
            shell.openExternal(url)
        }
    }

    show() {
        this.win.show()
        this.win.focus()
    }
}

module.exports = MailWindowController
