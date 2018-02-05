const { Tray, nativeImage } = require('electron');
const path = require('path');

class TrayController {
    constructor(mailController) {
        this.mailController = mailController
        this.init()
    }

    init() {
        this.tray = new Tray(this.createTrayIcon())

        this.tray.on('click', () => this.fireClickEvent())
    }

    createTrayIcon() {
        return nativeImage.createFromPath(path.join(__dirname, '../../assets/mail_white.png'))
    }

    fireClickEvent() {
        this.mailController.toggleWindow()
    }
}

module.exports = TrayController