const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const { spawn } = require("child_process");
const settings = require("electron-settings");
const getClientFile = require("./client-injector");
const path = require("path");

let mainMailServiceUrl;
let deeplinkUrls;
let safelinksUrls;
let mailServicesUrls;
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

    mainMailServiceUrl =
      settings.getSync("urlMainWindow") || "https://outlook.office.com/mail";
    deeplinkUrls = settings.getSync("urlsInternal") || [
      "outlook.live.com/mail/deeplink",
      "outlook.office365.com/mail/deeplink",
      "outlook.office.com/mail/deeplink",
      "outlook.office.com/calendar/deeplink",
      "to-do.office.com/tasks",
    ];
    mailServicesUrls = settings.getSync("urlsExternal") || [
      "outlook.live.com",
      "outlook.office365.com",
      "outlook.office.com",
    ];
    // // Outlook.com personal accounts tests values
    // mainMailServiceUrl =
    //   settings.getSync("urlMainWindow") || "https://login.live.com/login.srf";
    // deeplinkUrls = settings.getSync("urlsInternal") || [
    //   "outlook.com",
    //   "live.com",
    // ];
    // mailServicesUrls = settings.getSync("urlsExternal") || [
    //   "outlook.com",
    //   "live.com",
    // ];
    safelinksUrls = settings.getSync("safelinksUrls") || [
      "outlook.office.com/mail/safelink.html",
      "safelinks.protection.outlook.com",
    ];

    console.log("Loaded settings", {
      mainMailServiceUrl: mainMailServiceUrl,
      deeplinkUrls: deeplinkUrls,
      mailServicesUrls: mailServicesUrls,
      safelinksUrls: safelinksUrls,
    });
  }

  openExternalLink(url) {
    const customBrowserPath = settings.getSync("customBrowserPath");

    if (customBrowserPath) {
      // Use custom browser specified in settings
      console.log(`Opening URL in custom browser: ${customBrowserPath}`);
      spawn(customBrowserPath, [url], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else {
      // Fall back to system default browser
      shell.openExternal(url);
    }
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
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

    // Open DevTools in development mode
    if (isDev) {
      this.win.webContents.openDevTools();
    }

    const platform = process.platform;
    let userAgentOS;
    let customUserAgent;

    // Set OS-specific part of the user agent
    switch (platform) {
      case "darwin":
        userAgentOS = "Macintosh; Intel Mac OS X 10_15_7";
        break;
      case "linux":
        userAgentOS = "X11; Linux x86_64";
        break;
      case "win32":
      default:
        userAgentOS = "Windows NT 10.0; Win64; x64";
        break;
    }

    customUserAgent =
      "Mozilla/5.0 " +
      userAgentOS +
      " AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"; // TODO: Updated Edge version

    // and load the index.html of the app.
    this.win.loadURL(mainMailServiceUrl, {
      userAgent: customUserAgent,
    });

    console.log("Custom User Agent: " + customUserAgent);

    // Setup context menu for text selection and links
    this.win.webContents.on("context-menu", (_event, params) => {
      const menuTemplate = [];

      // Add text editing options if text is selected or in an editable field
      if (params.isEditable) {
        menuTemplate.push(
          { label: "Undo", role: "undo" },
          { label: "Redo", role: "redo" },
          { type: "separator" },
          { label: "Cut", role: "cut", enabled: params.editFlags.canCut },
          { label: "Copy", role: "copy", enabled: params.editFlags.canCopy },
          { label: "Paste", role: "paste", enabled: params.editFlags.canPaste },
          { type: "separator" },
          { label: "Select All", role: "selectAll" }
        );
      } else {
        // For non-editable content (reading emails)
        if (params.selectionText) {
          menuTemplate.push({
            label: "Copy",
            role: "copy",
          });
        }

        // Add link-specific options
        if (params.linkURL) {
          if (menuTemplate.length > 0) {
            menuTemplate.push({ type: "separator" });
          }
          menuTemplate.push(
            {
              label: "Open Link in Browser",
              click: () => {
                this.openExternalLink(params.linkURL);
              },
            },
            {
              label: "Copy Link Address",
              click: () => {
                const { clipboard } = require("electron");
                clipboard.writeText(params.linkURL);
              },
            }
          );
        }

        // Add select all if there's text content
        if (params.selectionText || params.pageURL) {
          if (menuTemplate.length > 0) {
            menuTemplate.push({ type: "separator" });
          }
          menuTemplate.push({ label: "Select All", role: "selectAll" });
        }
      }

      // Add inspect element in development mode
      if (isDev) {
        if (menuTemplate.length > 0) {
          menuTemplate.push({ type: "separator" });
        }
        menuTemplate.push({
          label: "Inspect Element",
          click: () => {
            this.win.webContents.inspectElement(params.x, params.y);
          },
        });
      }

      // Only show menu if there are items
      if (menuTemplate.length > 0) {
        const menu = Menu.buildFromTemplate(menuTemplate);
        menu.popup();
      }
    });

    // Show window handler
    ipcMain.on("show", (event) => {
      this.show();
    });

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

    this.win.webContents.setWindowOpenHandler(({ url }) => {
      console.log(url);
      // If url is a detatch from outlook then open in small window
      if (url === "about:blank") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
          },
        };
      }
      // Open MS Safe Links in local browser
      if (new RegExp(safelinksUrls.join("|")).test(url)) {
        this.openExternalLink(url);
        return {
          action: "deny",
        };
      }
      // If deeplink is detected, open it in new detached window from app
      if (new RegExp(deeplinkUrls.join("|")).test(url)) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
          },
        };
      }
      // Check if the URL matches any mailServicesUrls for outlook.com
      if (new RegExp(mailServicesUrls.join("|")).test(url)) {
        // Open main MS365 apps the same window
        safelinksUrls;
        this.win.loadURL(url);
        return {
          action: "deny",
        };
      }
      this.openExternalLink(url);
      return {
        action: "deny",
      };
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

  show() {
    initialMinimization.domReady = false;
    this.win.show();
    this.win.focus();
  }
}

module.exports = MailWindowController;
