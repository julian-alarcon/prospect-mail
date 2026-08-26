const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const { spawn } = require("child_process");
const settings = require("../settings");
const getClientFile = require("./client-injector");
const path = require("path");

let mainMailServiceUrl;
let deeplinkUrls;
let safelinksUrls;
let mailServicesUrls;
let showWindowFrame;

// Microsoft auth domains whose cookies are checked/cleaned for session recovery
const AUTH_DOMAINS = [
  "login.microsoftonline.com",
  "login.microsoft.com",
  "login.live.com",
  "outlook.cloud.microsoft",
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.live.com",
  "cloud.microsoft",
  "microsoft.com",
  "office.com",
  "live.com",
];

// Azure AD / MSAL / OWA auth cookie names
const AUTH_COOKIE_NAMES = new Set([
  "ESTSAUTH",
  "ESTSAUTHPERSISTENT",
  "ESTSAUTHLIGHT",
  "SignInStateCookie",
  "buid",
  "fpc",
  "x-ms-gateway-slice",
  "stsservicecookie",
  "CCState",
  "FedAuth",
  "rtFa",
]);

// Login-required recovery state. Lives in the main process so it survives
// page reloads (renderer state is wiped on each reload).
let loginRequiredRetryCount = 0;
let lastLoginRequiredReloadAt = 0;
const LOGIN_REQUIRED_COOLDOWN_MS = 60 * 1000; // 1 minute between reload attempts
const MAX_LOGIN_REQUIRED_RETRIES = 3;          // then fall back to notification

// Outlook mail URL patterns — landing here means recovery worked
const OUTLOOK_URL_PATTERNS = [
  "outlook.cloud.microsoft",
  "outlook.office.com",
  "outlook.live.com",
  "outlook.office365.com",
];

//Setted by cmdLine to initial minimization
const initialMinimization = {
  domReady: false,
};

class MailWindowController {
  constructor() {
    this.init();
    // Check both command-line flag and settings for initial minimization
    const hasMinimizedFlag = global.cmdLine.indexOf("--minimized") !== -1;
    const startMinimizedSetting = settings.get("startupWindowState") === "minimized";
    initialMinimization.domReady = hasMinimizedFlag || startMinimizedSetting;
  }
  reloadSettings() {
    // Get configurations.
    showWindowFrame = settings.get("showWindowFrame");

    mainMailServiceUrl = settings.get("urlMainWindow");
    deeplinkUrls = settings.get("urlsInternal");
    mailServicesUrls = settings.get("urlsExternal");
    safelinksUrls = settings.get("safelinksUrls");

    console.log("Loaded settings", {
      mainMailServiceUrl: mainMailServiceUrl,
      deeplinkUrls: deeplinkUrls,
      mailServicesUrls: mailServicesUrls,
      safelinksUrls: safelinksUrls,
    });

    // Compile RegExp patterns once for performance and security
    // Escape special regex characters to prevent ReDoS attacks
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.safelinksPattern = new RegExp(safelinksUrls.map(escapeRegex).join("|"));
    this.deeplinkPattern = new RegExp(deeplinkUrls.map(escapeRegex).join("|"));
    this.mailServicesPattern = new RegExp(mailServicesUrls.map(escapeRegex).join("|"));
  }

  openExternalLink(url) {
    // Validate URL protocol for security
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn('Blocked non-HTTP(S) URL:', url);
        return;
      }
    } catch (err) {
      console.error('Invalid URL:', url, err);
      return;
    }

    const customBrowserPath = settings.get("customBrowserPath");

    if (customBrowserPath) {
      // Use custom browser specified in settings
      console.log(`Opening URL in custom browser: ${customBrowserPath}`);
      try {
        const child = spawn(customBrowserPath, [url], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        child.on('error', (err) => {
          console.error('Failed to spawn custom browser:', err);
          // Fallback to system default browser
          shell.openExternal(url);
        });
      } catch (err) {
        console.error('Failed to spawn custom browser:', err);
        shell.openExternal(url);
      }
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
        // Keep the injected unread observer's timers running while the window is
        // hidden to tray (hideOnClose/hideOnMinimize). Chromium throttles timers
        // in hidden windows by default, which stopped new-mail detection in the
        // tray (#415).
        backgroundThrottling: false,
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

    // Derive the version from the bundled Chromium so the UA stays correct on
    // Electron bumps. Chrome/Edge freeze the UA to MAJOR.0.0.0 (UA reduction).
    const chromeMajor = process.versions.chrome.split(".")[0];
    customUserAgent =
      "Mozilla/5.0 " +
      userAgentOS +
      ` AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36 Edg/${chromeMajor}.0.0.0`;

    // and load the index.html of the app.
    // Clean expired auth cookies first so Outlook starts from a clean session
    // state, giving SSO the best chance to silently re-authenticate (#419).
    this.cleanExpiredAuthCookies().finally(() => {
      this.win.loadURL(mainMailServiceUrl, {
        userAgent: customUserAgent,
      });
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

    // Native notification handler
    ipcMain.on("show-notification", (_event, { title, body, icon }) => {
      const { Notification, nativeImage } = require("electron");

      // Check if notifications are supported
      if (!Notification.isSupported()) {
        console.log("Notifications are not supported on this system");
        return;
      }

      console.log("[Notification] Request received:", { title, bodyLength: body?.length || 0 });

      // Create notification config
      const notificationConfig = {
        title,
        body,
      };

      // Handle icon - use nativeImage if it's a data URL, otherwise use file path
      const iconPath = icon || path.join(__dirname, "../../assets/outlook_linux_black.png");
      if (iconPath.startsWith("data:")) {
        notificationConfig.icon = nativeImage.createFromDataURL(iconPath);
      } else {
        notificationConfig.icon = iconPath;
      }

      // Create and show native notification
      const notification = new Notification(notificationConfig);

      notification.on("click", () => {
        this.show();
      });

      notification.show();
    });

    // Login-required recovery: the renderer reports that the inbox can't be
    // found (session expired / redirected to sign-in). We attempt a silent
    // reload a few times — if Outlook's SSO cookies are still valid the reload
    // re-authenticates transparently. After max retries we notify the user.
    ipcMain.on("report-login-required", (_event, reason) => {
      const now = Date.now();

      // On a real sign-in page: reloading can't recover the session (silent SSO
      // already failed) and would interrupt the user typing credentials or doing
      // MFA. Just notify so a minimized/tray user knows to sign in.
      if (reason === "login-page") {
        console.log("[LoginRequired] On sign-in page, notifying (no reload)");
        this.showAppNotification(
          "Prospect Mail: Sign in required",
          "Outlook requires you to sign in again. Click here to open Prospect Mail."
        );
        return;
      }

      if (loginRequiredRetryCount >= MAX_LOGIN_REQUIRED_RETRIES) {
        console.log("[LoginRequired] Max retries reached, showing notification");
        this.showAppNotification(
          "Prospect Mail: Sign in required",
          "Outlook requires you to sign in again. Click here to open Prospect Mail."
        );
        return;
      }

      if (lastLoginRequiredReloadAt > 0 && now - lastLoginRequiredReloadAt < LOGIN_REQUIRED_COOLDOWN_MS) {
        console.log("[LoginRequired] Within cooldown, ignoring");
        return;
      }

      loginRequiredRetryCount++;
      lastLoginRequiredReloadAt = now;
      console.log(
        `[LoginRequired] Auto-reloading to recover session (attempt ${loginRequiredRetryCount}/${MAX_LOGIN_REQUIRED_RETRIES})`
      );
      this.reloadWindow();
    });

    // Reset the retry counter when we land back on an Outlook mail page —
    // that means a reload (or manual sign-in) succeeded.
    this.win.webContents.on("did-navigate", (_event, url) => {
      if (
        url &&
        OUTLOOK_URL_PATTERNS.some((p) => url.includes(p)) &&
        loginRequiredRetryCount > 0
      ) {
        console.log("[LoginRequired] Back on Outlook, resetting retry count");
        loginRequiredRetryCount = 0;
      }
    });

    // After resuming from sleep, cookies may have expired during suspend.
    // Clean them so Outlook doesn't show a stale session state.
    const { powerMonitor } = require("electron");
    powerMonitor.on("resume", () => {
      this.cleanExpiredAuthCookies();
    });

    // insert styles
    this.win.webContents.on("dom-ready", () => {
      this.win.webContents.insertCSS(getClientFile("main.css"));
      if (!showWindowFrame) {
        this.win.webContents.insertCSS(getClientFile("no-frame.css"));
      }

      this.addUnreadNumberObserver();
      if (!initialMinimization.domReady) {
        // A minimized startup keeps the window hidden, so if we're here we only
        // need to honor the maximized case. maximize() also shows the window.
        if (settings.get("startupWindowState") === "maximized") {
          this.win.maximize();
        } else {
          this.win.show();
        }
      }
    });

    this.win.webContents.setWindowOpenHandler(({ url }) => {
      console.log(url);
      // If url is a detach from outlook then open in small window
      if (url === "about:blank") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
          },
        };
      }
      // Open MS Safe Links in local browser
      if (this.safelinksPattern && this.safelinksPattern.test(url)) {
        this.openExternalLink(url);
        return {
          action: "deny",
        };
      }
      // If deeplink is detected, open it in new detached window from app
      if (this.deeplinkPattern && this.deeplinkPattern.test(url)) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
          },
        };
      }
      // Check if the URL matches any mailServicesUrls for outlook.com
      if (this.mailServicesPattern && this.mailServicesPattern.test(url)) {
        // Open main MS365 apps the same window
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
        if (settings.get("hideOnClose")) {
          e.preventDefault();
          this.win.hide();
        }
      }
    });

    // prevent the app minimze, hide the window instead.
    this.win.on("minimize", (e) => {
      if (settings.get("hideOnMinimize")) {
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
    const showUnreadNotifications = settings.get("showUnreadNotifications");
    this.win.webContents.executeJavaScript(
      `window.prospectMailConfig = Object.assign(window.prospectMailConfig || {}, { showUnreadNotifications: ${JSON.stringify(showUnreadNotifications)} });`
    );
    this.win.webContents.executeJavaScript(
      getClientFile("unread-number-observer.js")
    );
  }

  /**
   * Removes expired auth cookies for Microsoft domains. Only cookies past
   * their expirationDate are removed — valid cookies are preserved. This
   * prevents Outlook from loading with a stale session that shows the
   * "sign in again" state instead of auto-authenticating via SSO.
   */
  async cleanExpiredAuthCookies() {
    try {
      const allCookies = await this.win.webContents.session.cookies.get({});
      const nowSeconds = Date.now() / 1000;

      const expired = allCookies.filter((cookie) => {
        const domain = (cookie.domain || "").replace(/^\./, "");
        const isAuthDomain = AUTH_DOMAINS.some(
          (d) => domain === d || domain.endsWith("." + d)
        );
        return (
          isAuthDomain &&
          AUTH_COOKIE_NAMES.has(cookie.name) &&
          cookie.expirationDate &&
          cookie.expirationDate < nowSeconds
        );
      });

      if (expired.length === 0) {
        console.log("[Auth] No expired auth cookies found");
        return;
      }

      console.log(`[Auth] Removing ${expired.length} expired auth cookie(s)`);
      for (const cookie of expired) {
        try {
          const protocol = cookie.secure ? "https" : "http";
          const domain = cookie.domain.startsWith(".")
            ? cookie.domain.substring(1)
            : cookie.domain;
          const url = `${protocol}://${domain}${cookie.path || "/"}`;
          await this.win.webContents.session.cookies.remove(url, cookie.name);
        } catch (err) {
          console.warn(`[Auth] Failed to remove cookie ${cookie.name}:`, err.message);
        }
      }
    } catch (err) {
      console.warn("[Auth] Cookie check failed:", err.message);
    }
  }

  /**
   * Shows a native notification directly from the main process (used for the
   * login-required fallback when auto-reload is exhausted).
   */
  showAppNotification(title, body) {
    const { Notification } = require("electron");
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, "../../assets/outlook_linux_black.png"),
    });
    notification.on("click", () => this.show());
    notification.show();
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

    // Raise with exactly ONE Wayland activation. restore()/show()/focus()
    // each triggers an xdg-activation, but only the first consumes the token
    // GNOME forwarded on notification click; extra calls just mint stale
    // tokens that GNOME rejects with an "X is ready" prompt. moveTop() is a
    // no-op on Wayland and never consumes the token.
    // See https://github.com/electron/electron/pull/50568
    if (this.win.isMinimized()) {
      this.win.restore(); // also raises + focuses
    } else if (this.win.isVisible()) {
      this.win.focus();
    } else {
      this.win.show(); // also focuses
    }
  }
}

module.exports = MailWindowController;
