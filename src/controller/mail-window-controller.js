const { BrowserWindow, shell } = require('electron')
const settings = require('electron-settings');
const CssInjector = require('../js/css-injector')

const outlookUrl = 'https://outlook.office.com/mail'

class MailWindowController {
    constructor() {
        this.init()
    }

    init() {
        // Get configurations.
        const showWindowFrame = settings.get('showWindowFrame', true)

        // Create the browser window.
        this.win = new BrowserWindow({
            x: 100,
            y: 100,
            width: 1400,
            height: 900,
            frame: showWindowFrame,
            autoHideMenuBar: true,
            show: false
        })

        // and load the index.html of the app.
        this.win.loadURL(outlookUrl)

        // insert styles
        this.win.webContents.on('dom-ready', () => {
            this.win.webContents.insertCSS(CssInjector.main)
            if (!showWindowFrame) this.win.webContents.insertCSS(CssInjector.noFrame)
            
            this.addUnreadNumberObserver()

            this.win.show()
        })

        // prevent the app quit, hide the window instead.
        this.win.on('close', (e) => {
            if (this.win.isVisible()) {
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

    addUnreadNumberObserver() {
        this.win.webContents.executeJavaScript(`
            setTimeout(() => {
                let unreadSpan = document.querySelector('._2iKri0mE1PM9vmRn--wKyI');
                require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

                let observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        console.log('Observer Changed.');
                        require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());
                    });
                });
            
                observer.observe(unreadSpan, {childList: true});
            }, 10000);
        `)
    }

    toggleWindow() {
        if (this.win.isFocused()) {
            this.win.hide()
        } else {
            this.show()
        }
    }

    openInBrowser(e, url) {
        e.preventDefault()
        shell.openExternal(url)
    }

    show() {
        this.win.show()
        this.win.focus()
    }
}

module.exports = MailWindowController
