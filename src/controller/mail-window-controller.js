const { app, BrowserWindow, shell, ipcMain } = require('electron')
const settings = require('electron-settings')
const CssInjector = require('../js/css-injector')
const path = require('path')

let outlookUrl
let deeplinkUrls
let outlookUrls
let showWindowFrame
let $this

//Setted by cmdLine to initial minimization
const initialMinimization = {
    domReady: false
} 

class MailWindowController {
    constructor() {
        $this = this
        this.init()
        initialMinimization.domReady = global.cmdLine.indexOf('--minimized') != -1
    }
    reloadSettings() {
        // Get configurations.
        showWindowFrame = settings.getSync('showWindowFrame') === undefined || settings.getSync('showWindowFrame')===true

        outlookUrl = settings.getSync('urlMainWindow') || 'https://outlook.office.com/mail'
        deeplinkUrls = settings.getSync('urlsInternal') || ['outlook.live.com/mail/deeplink', 'outlook.office365.com/mail/deeplink', 'outlook.office.com/mail/deeplink', 'outlook.office.com/calendar/deeplink']
        outlookUrls = settings.getSync('urlsExternal') || ['outlook.live.com', 'outlook.office365.com', 'outlook.office.com']
        console.log('Loaded settings', {
            outlookUrl: outlookUrl
            , deeplinkUrls: deeplinkUrls
            , outlookUrls: outlookUrls
        })
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
            autoHideMenuBar: true,

            show: false,
            title: 'Prospect Mail',
            icon: path.join(__dirname, '../../assets/outlook_linux_black.png'),
            webPreferences: {
                spellcheck: true,
                nativeWindowOpen: true,
                affinity: 'main-window'
            }
        })

        // and load the index.html of the app.
        this.win.loadURL(outlookUrl)

        // Show window handler
        ipcMain.on('show', (event) => {
            this.show()
        })

        // insert styles
        this.win.webContents.on('dom-ready', () => {
            this.win.webContents.insertCSS(CssInjector.main)
            if (!showWindowFrame) this.win.webContents.insertCSS(CssInjector.noFrame)

            this.addUnreadNumberObserver()
            console.log('initialMinimization.domReady', initialMinimization.domReady)
            if (!initialMinimization.domReady) {
                this.win.show()
            }             
        })

        // prevent the app quit, hide the window instead.
        this.win.on('close', (e) => {
            //console.log('Log invoked: ' + this.win.isVisible())
            if (this.win.isVisible()) {
                if (settings.getSync('hideOnClose') === undefined || settings.getSync('hideOnClose') === true) {
                    e.preventDefault()
                    this.win.hide()
                }
            }
        })

        // prevent the app minimze, hide the window instead.
        this.win.on('minimize', (e) => {
            console.log('minimize',settings.getSync('hideOnMinimize'))
            if (settings.getSync('hideOnMinimize') === undefined || settings.getSync('hideOnMinimize')===true) {
                e.preventDefault()
                this.win.hide()
            }
        });

        // Emitted when the window is closed.
        this.win.on('closed', () => {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            this.win = null
            if (!global.preventAutoCloseApp) {
                app.exit(0) //dont should the app exit is mainWindow is closed?
            }
            global.preventAutoCloseApp = false
        })

        // Open the new window in external browser
        this.win.webContents.on('new-window', this.openInBrowser)
    }

    addUnreadNumberObserver() {
        this.win.webContents.executeJavaScript(`
            setTimeout(() => {
                let unreadSpan = document.querySelector('._2iKri0mE1PM9vmRn--wKyI');
                require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

                let observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        console.log('Observer Changed.');
                        require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

                        // Scrape messages and pop up a notification
                        var messages = document.querySelectorAll('div[role="listbox"][aria-label="Message list"]');
                        if (messages.length)
                        {
                            var unread = messages[0].querySelectorAll('div[aria-label^="Unread"]');
                            var body = "";
                            for (var i = 0; i < unread.length; i++)
                            {
                                if (body.length)
                                {
                                    body += "\\n";
                                }
                                body += unread[i].getAttribute("aria-label").substring(7, 127);
                            }
                            if (unread.length)
                            {
                                var notification = new Notification(unread.length + " New Messages", {
                                    body: body,
                                    icon: "assets/outlook_linux_black.png"
                                });
                                notification.onclick = () => {
                                    require('electron').ipcRenderer.send('show');
                                };
                            }
                        }
                    });
                });
            
                observer.observe(unreadSpan, {childList: true});

                // If the div containing reminders gets taller we probably got a new
                // reminder, so force the window to the top.
                let reminders = document.getElementsByClassName("_1BWPyOkN5zNVyfbTDKK1gM");
                let height = 0;
                let reminderObserver = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        if (reminders[0].clientHeight > height)
                        {
                            require('electron').ipcRenderer.send('show');
                        }
                        height = reminders[0].clientHeight;
                    });
                });

                if (reminders.length) {
                    reminderObserver.observe(reminders[0], { childList: true });
                }

            }, 10000);
        `)
    }

    toggleWindow() {
        console.log("toggleWindow", {
            isFocused: this.win.isFocused(),
            isVisible: this.win.isVisible()
        })
        if (/*this.win.isFocused() && */this.win.isVisible()) {
            this.win.hide()
        } else {
            console.log('toggleWindow')
            initialMinimization.domReady = false
            this.show()
        }
    }
    reloadWindow() {
        initialMinimization.domReady = false
        this.win.reload()
    }

    openInBrowser(e, url, frameName, disposition, options) {
        console.log('Open in browser: ' + url)//frameName,disposition,options)
        if (new RegExp(deeplinkUrls.join('|')).test(url)) {
            // Default action - if the user wants to open mail in a new window - let them.
            //e.preventDefault()
            console.log('Is deeplink')
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
        initialMinimization.domReady = false
        this.win.show()
        this.win.focus()
    }
}

module.exports = MailWindowController
