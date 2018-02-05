const { BrowserWindow } = require('electron')

const outlookUrl = 'https://outlook.live.com/mail'

class MailWindowController {
    constructor() {
        this.init()
    }

    init() {
        // Create the browser window.
        this.win = new BrowserWindow({ width: 1200, height: 800 })

        // and load the index.html of the app.
        this.win.loadURL(outlookUrl)

        // prevent the app quit, hide the window instead.
        this.win.on('close', (e) => {
            if(this.win.isVisible()) {
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
    }

    show() {
        this.win.show()
        this.win.focus()
    }

    toggleWindow() {
        if(this.win.isVisible()) {
            this.win.hide()
        } else {
            this.show()
        }
    }
}

module.exports = MailWindowController