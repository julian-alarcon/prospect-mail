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
    hideOnMinimize: true,
    startMinimized: false,
    disableUnreadNotifications: false,
    customBrowserPath: undefined
  }
});

module.exports = settings;
