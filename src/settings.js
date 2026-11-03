const Store = require('electron-store');

// Note: This module is loaded after app.setPath() in main.js has set the userData path
// to 'prospect-mail', ensuring settings stay in the same directory location.

// Centralized settings store with defaults
const settings = new Store({
  name: 'settings',
  clearInvalidConfig: true,  // Auto-handle corrupted configs
  defaults: {
    // outlook.cloud.microsoft is Microsoft's unified-domain Outlook host and is
    // now the principal URL. The legacy office.com / office365.com / live.com
    // hosts remain valid endpoints and are kept for compatibility.
    urlMainWindow: "https://outlook.cloud.microsoft/mail",
    urlsInternal: [
      "outlook.cloud.microsoft/mail/deeplink",
      "outlook.cloud.microsoft/calendar/deeplink",
      "outlook.live.com/mail/deeplink",
      "outlook.office365.com/mail/deeplink",
      "outlook.office.com/mail/deeplink",
      "outlook.office.com/calendar/deeplink",
      "to-do.office.com/tasks",
    ],
    urlsExternal: [
      "outlook.cloud.microsoft",
      "outlook.live.com",
      "outlook.office365.com",
      "outlook.office.com",
    ],
    safelinksUrls: [
      "outlook.cloud.microsoft/mail/safelink.html",
      "outlook.office.com/mail/safelink.html",
      "safelinks.protection.outlook.com",
    ],
    showWindowFrame: true,
    hideOnClose: true,
    // Default off so minimize behaves like a standard window (stays in the
    // taskbar), mirroring Teams for Linux. hideOnClose still sends the app to
    // the tray, which is the more useful "keep running in background" case.
    hideOnMinimize: false,
    // Startup window state is a single choice: "normal" | "minimized" | "maximized".
    startupWindowState: "normal",
    // Positive phrasing: true = show desktop notifications for new mail.
    showUnreadNotifications: true,
    // Which folders drive the unread badge and new-mail notifications:
    //   "inbox"     — the Inbox folder only (default, original behaviour)
    //   "favorites" — sum of unread across the Outlook Favorites folders
    unreadNotificationSource: "inbox",
    customBrowserPath: undefined,

    // ---- Compatibility (changes need an app restart) ----
    // Disable WebAuthn / passkeys in the embedded browser. Electron on Linux
    // has no passkey UI, so accounts with a registered passkey hang forever on
    // Microsoft's "Face, fingerprint, PIN or security key" page. With WebAuthn
    // disabled Microsoft falls back to password sign-in.
    disableWebAuthn: process.platform === "linux",
    // Rendering backend on Linux: "auto" | "wayland" | "x11".
    // Native Wayland on NVIDIA crashes the GPU process repeatedly and leaves
    // Chromium in slow software rendering; "auto" uses X11 (XWayland) when
    // the NVIDIA driver is loaded in a Wayland session and Electron's default
    // otherwise. The other values force a backend.
    renderingBackend: "auto",
  }
});

// One-time migration from the pre-1.3.0 settings schema to the current one.
// Done imperatively (guarded by has()) rather than with electron-store's
// version-keyed migrations, which behave unreliably across prerelease (-beta)
// version strings. Legacy keys are no longer in `defaults`, so has() is true
// only for values a previous version actually persisted to disk.
migrateLegacySettings(settings);

function migrateLegacySettings(store) {
  // startMinimized + startMaximized booleans -> startupWindowState enum.
  // startMinimized wins if both were somehow set.
  if (store.has("startMinimized") || store.has("startMaximized")) {
    const wasMinimized = store.get("startMinimized", false);
    const wasMaximized = store.get("startMaximized", false);
    store.set(
      "startupWindowState",
      wasMinimized ? "minimized" : wasMaximized ? "maximized" : "normal"
    );
    store.delete("startMinimized");
    store.delete("startMaximized");
  }

  // disableUnreadNotifications (negated) -> showUnreadNotifications (positive).
  if (store.has("disableUnreadNotifications")) {
    store.set(
      "showUnreadNotifications",
      !store.get("disableUnreadNotifications")
    );
    store.delete("disableUnreadNotifications");
  }
}

module.exports = settings;
