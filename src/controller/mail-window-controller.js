const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  MenuItem,
  clipboard,
} = require("electron");
const settings = require("electron-settings");
const getClientFile = require("./client-injector");
const path = require("path");


let outlookUrl;
let deeplinkUrls;
let externalUrls;
let outlookUrls;
let showWindowFrame;
let $this;

//Setted by cmdLine to initial minimization
const initialMinimization = {
  domReady: false,
};

class MailWindowController {
  constructor() {
    $this = this;
    this.init();
    initialMinimization.domReady = global.cmdLine.indexOf("--minimized") != -1;
  }
  reloadSettings() {
    // Get configurations.
    showWindowFrame =
      settings.getSync("showWindowFrame") === undefined ||
      settings.getSync("showWindowFrame") === true;

    outlookUrl =
      settings.getSync("urlMainWindow") || "https://outlook.office.com/mail";
    deeplinkUrls = settings.getSync("urlsInternal") || [
      "outlook.live.com/mail/deeplink",
      "outlook.office365.com/mail/deeplink",
      "outlook.office.com/mail/deeplink",
      "outlook.office.com/calendar/deeplink",
    ];
    outlookUrls = settings.getSync("urlsExternal") || [
      "outlook.live.com",
      "outlook.office365.com",
      "outlook.office.com",
    ];
    externalUrls = settings.getSync('externalUrls') || [
      'outlook.office.com/mail/safelink.html'
    ]
    console.log("Loaded settings", {
      outlookUrl: outlookUrl,
      deeplinkUrls: deeplinkUrls,
      outlookUrls: outlookUrls,
      externalUrls: externalUrls,
    });
  }
  init() {
    this.reloadSettings();

    // Create the browser window.
    this.win = new BrowserWindow({
      x: 100,
      y: 100,
      width: 1400,
      height: 900,
      frame: showWindowFrame,
      autoHideMenuBar: true,

      show: false,
      title: "Prospect Mail",
      icon: path.join(__dirname, "../../assets/outlook_linux_black.png"),
      webPreferences: {
        spellcheck: true,
        nativeWindowOpen: true,
        affinity: "main-window",
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    // and load the index.html of the app.
    this.win.loadURL(outlookUrl, { userAgent: "Chrome" });

    // Show window handler
    ipcMain.on("show", (event) => {
      this.show();
    });

    // add right click handler for editor spellcheck
    this.setupContextMenu(this.win);

    // insert styles
    this.win.webContents.on("dom-ready", () => {
      this.win.webContents.insertCSS(getClientFile("main.css"));
      if (!showWindowFrame) {
        this.win.webContents.insertCSS(getClientFile("no-frame.css"));
      }

      this.addUnreadNumberObserver();
      if (!initialMinimization.domReady) {
        this.win.show();
      }
    });

    this.win.webContents.on("did-create-window", (childWindow) => {
      // insert styles
      childWindow.webContents.on("dom-ready", () => {
        childWindow.webContents.insertCSS(getClientFile("main.css"));

        this.setupContextMenu(childWindow);

        let that = this;
        if (!showWindowFrame) {
          let a = childWindow.webContents.insertCSS(
            getClientFile("no-frame.css")
          );
          a.then(() => {
            childWindow.webContents
              .executeJavaScript(getClientFile("child-window.js"))
              .then(() => {
                childWindow.webContents.on("new-window", this.openInBrowser);
                childWindow.show();
              })
              .catch((errJS) => {
                console.log("Error JS Insertion:", errJS);
              });
          }).catch((err) => {
            console.log("Error CSS Insertion:", err);
          });
        }
      });
    });

    // prevent the app quit, hide the window instead.
    this.win.on("close", (e) => {
      //console.log('Log invoked: ' + this.win.isVisible())
      if (this.win.isVisible()) {
        if (
          settings.getSync("hideOnClose") === undefined ||
          settings.getSync("hideOnClose") === true
        ) {
          e.preventDefault();
          this.win.hide();
        }
      }
    });

    // prevent the app minimze, hide the window instead.
    this.win.on("minimize", (e) => {
      if (
        settings.getSync("hideOnMinimize") === undefined ||
        settings.getSync("hideOnMinimize") === true
      ) {
        e.preventDefault();
        this.win.hide();
      }
    });

    // Emitted when the window is closed.
    this.win.on("closed", () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      this.win = null;
      if (!global.preventAutoCloseApp) {
        app.exit(0); //dont should the app exit is mainWindow is closed?
      }
      global.preventAutoCloseApp = false;
    });

    // Open the new window in external browser
    this.win.webContents.on("new-window", this.openInBrowser);
  }
  addUnreadNumberObserver() {
    this.win.webContents.executeJavaScript(
      getClientFile("unread-number-observer.js")
    );
  }

  toggleWindow() {
    console.log("toggleWindow", {
      isFocused: this.win.isFocused(),
      isVisible: this.win.isVisible(),
    });
    if (/*this.win.isFocused() && */ this.win.isVisible()) {
      this.win.hide();
    } else {
      initialMinimization.domReady = false;
      this.show();
    }
  }
  reloadWindow() {
    initialMinimization.domReady = false;
    this.win.reload();
  }

  openInBrowser(e, url, frameName, disposition, options) {
    console.log("Open in browser: " + url); //frameName,disposition,options)

    if (!new RegExp(externalUrls.join("|")).test(url)) {
      if (new RegExp(deeplinkUrls.join("|")).test(url)) {
        // Default action - if the user wants to open mail in a new window - let them.
        //e.preventDefault()
        console.log("Is deeplink, open in main window");
        options.webPreferences.affinity = "main-window";
        return;
      }
      if (new RegExp(outlookUrls.join("|")).test(url)) {
        // Open calendar, contacts and tasks in the same window
        console.log("Is outlook URL, open in application");
        e.preventDefault();
        this.loadURL(url);
        return;
      }
    }
    // Send everything else to the browser
    console.log("Is external URL, open in browser");
    e.preventDefault();
    shell.openExternal(url);
  }

  show() {
    initialMinimization.domReady = false;
    this.win.show();
    this.win.focus();
  }

  setupContextMenu(tWin) {
    tWin.webContents.on("context-menu", (event, params) => {
      event.preventDefault();
      //console.log('context-menu', params)
      let menu = new Menu();

      if (params.linkURL) {
        menu.append(
          new MenuItem({
            label:
              params.linkURL.length > 50
                ? params.linkURL.substring(0, 50 - 3) + "..."
                : params.linkURL,
            enabled: false,
          })
        );
        menu.append(
          new MenuItem({
            label: "Copy link url",
            enabled: true,
            click: (arg) => {
              clipboard.writeText(params.linkURL, "url");
            },
          })
        );
        menu.append(
          new MenuItem({
            label: "Copy link text",
            enabled: true,
            click: (arg) => {
              clipboard.writeText(params.linkText, "selection");
            },
          })
        );
      }
      //console.log(params)
      for (const flag in params.editFlags) {
        let actionLabel = flag.substring(3); //remove "can"
        if (flag == "canSelectAll") {
          actionLabel = "Select all";
          if (!params.isEditable) {
            continue;
          }
        }
        if (flag == "canUndo" || flag == "canRedo") {
          if (!params.isEditable) {
            continue;
          }
        }
        if (flag == "canEditRichly") {
          continue;
        }
        if (params.editFlags[flag]) {
          menu.append(
            new MenuItem({
              label: actionLabel,
              enabled: true,
              role: flag.substring(3).toLowerCase(),
            })
          );
        }
      }
      if (menu.items.length > 0) {
        menu.popup();
      }
    });
  }
}

module.exports = MailWindowController;
