const Store = require('electron-store');

// Note: This module is loaded after app.setPath() in main.js has set the userData path
// to 'prospect-mail', ensuring settings stay in the same directory location.

// Centralized settings store with defaults
const settings = new Store({
  name: 'settings',
  clearInvalidConfig: true,  // Auto-handle corrupted configs
  defaults: {
    urlMainWindow: "https://outlook.office.com/mail",
    urlsInternal: [
      "outlook.live.com/mail/deeplink",
      "outlook.office365.com/mail/deeplink",
      "outlook.office.com/mail/deeplink",
      "outlook.office.com/calendar/deeplink",
      "to-do.office.com/tasks",
    ],
    urlsExternal: [
      "outlook.live.com",
      "outlook.office365.com",
      "outlook.office.com",
    ],
    safelinksUrls: [
      "outlook.office.com/mail/safelink.html",
      "safelinks.protection.outlook.com",
    ],
    showWindowFrame: true,
    hideOnClose: true,
    hideOnMinimize: true,
    startMinimized: false,
    customBrowserPath: undefined
  }
});

module.exports = settings;
