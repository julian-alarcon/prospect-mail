const { BrowserWindow, shell } = require('electron')
const CssInjector = require('../js/css-injector')

const outlookUrl = 'https://outlook.live.com/mail'

class MailWindowController {
    constructor() {
        this.init()
    }

    init() {
        // Create the browser window.
        this.win = new BrowserWindow({
            x: 100,
            y: 100,
            width: 1400,
            height: 900,
            frame: false,
            autoHideMenuBar: true
        })

        // and load the index.html of the app.
        this.win.loadURL(outlookUrl)

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

        // insert styles
        this.win.webContents.on('dom-ready', () => {
            this.win.webContents.insertCSS(CssInjector.main)
            this.getUnreadNumber()
            this.addUnreadNumberObserver()
        })

        // Open the new window in external browser
        this.win.webContents.on('new-window', this.openInBrowser)
    }

    getUnreadNumber() {
        this.win.webContents.executeJavaScript(`
            setTimeout(() => {
                let unreadSpan = document.querySelector('.o30C-0mPu4HVLw3tCQIgs');
                unreadSpan = unreadSpan.cloneNode(true);
                unreadSpan.childNodes.forEach(item => {
                    if (item.tagName) unreadSpan.removeChild(item);
                });
                console.log(unreadSpan.innerText);
                require('electron').ipcRenderer.send('updateUnread', unreadSpan.innerText);
            }, 10000);
        `)
    }

    addUnreadNumberObserver() {
        this.win.webContents.executeJavaScript(`
            setTimeout(() => {
                let unreadSpan = document.querySelector('._1hXsFjg4AlONLqIMDQOMlU');
                let observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        console.log('Find change....');
                        let copiedSpan = unreadSpan.cloneNode(true);
                        copiedSpan.childNodes.forEach(item => {
                            if (item.tagName) copiedSpan.removeChild(item);
                        });
                        require('electron').ipcRenderer.send('updateUnread', copiedSpan.innerText);
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
            this.win.show()
        }
    }

    openInBrowser(e, url) {
        e.preventDefault()
        shell.openExternal(url)
    }
}

module.exports = MailWindowController