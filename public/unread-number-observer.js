// Configuration constants
const CONFIG = {
  // Anti-spam throttle times
  unreadEmailThrottleMs: 10000,   // 10 seconds between unread email notifications
  calendarReminderThrottleMs: 10000, // 10 seconds between calendar notifications

  // Debounce and polling intervals
  mutationDebounceMs: 1000,          // 1 second debounce for mutation observers
  unreadCheckIntervalMs: 5000,       // 5 seconds between periodic unread checks

  // Retry delays
  handlerRetryDelayMs: 5000,         // 5 seconds before retrying failed handlers
  handlerRetryAgainDelayMs: 10000,   // 10 seconds for subsequent retry attempts

  // Session-expiry / sign-in detection (see the detection block below)
  authNeededWindowMs: 20000, // window over which repeated AuthNeeded errors are counted
  authNeededMinHits: 2,      // AuthNeeded rejections within the window before we notify
  loginPageConfirmMs: 8000,  // a sign-in URL must persist this long to count (ignores SSO bounces)
};

let unreadCheckTimer;
let lastUnreadNotificationTime;
let lastCalendarNotificationTime;
let lastUnreadCount = 0;           // Track previous unread count
let lastReminderCount = 0;          // Track previous reminder count

// Helper to create and show notifications using native Electron notifications
const showNotification = (title, body) => {
  console.log('showNotification called:', { title, body });
  console.log('Creating native Electron notification...');

  // Use native Electron notification via IPC
  // Icon is handled by main process using file path
  window.electronAPI.showNotification(title, body);
  console.log('Native notification request sent to main process');
};

// ── Session-expiry / sign-in detection ─────────────────────────────────────
// Outlook Web never surfaces MSAL's `interaction_required`. Instead its data
// layer rejects failed calls with "<operation> failed: AuthNeeded" while the
// session is expired (the red "Your session has expired" banner, with the mail
// UI still fully rendered). That `AuthNeeded` token is our language-independent
// signal. The other case is a hard redirect to a Microsoft sign-in page.
//
// Neither auto-reloads: silent SSO has already failed, so only an interactive
// sign-in recovers, and a blind reload would loop or wipe a half-entered login.
// We just notify the main process, which can warn a tray/minimized user. A
// stuck/blank page from a dropped connection is handled separately, in the main
// process, via `did-fail-load` (a real network error, not a login problem).
let loginRequiredReported = false;

const LOGIN_URL_PATTERNS = [
  'login.microsoftonline.com',
  'login.live.com',
  'login.microsoft.com',
];

const isOnLoginPageUrl = (href) =>
  !!href && LOGIN_URL_PATTERNS.some((p) => href.includes(p));

const isOnLoginPage = () => {
  try {
    return isOnLoginPageUrl(window.location.href);
  } catch {
    return false;
  }
};

// Pull a string message out of whatever a promise rejected with.
const rejectionMessage = (reason) => {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  return reason.message || reason.errorMessage || String(reason);
};

// OWA marks an expired session by rejecting data calls with a "...: AuthNeeded"
// error. Match the whole token so an unrelated word can't false-match.
const isAuthNeededRejection = (reason) => /\bAuthNeeded\b/.test(rejectionMessage(reason));

const reportLoginRequired = (reason) => {
  if (loginRequiredReported) return;
  loginRequiredReported = true;
  console.log('Login required detected, reporting to main process', { reason });
  window.electronAPI.reportLoginRequired(reason);
};

// Require a few AuthNeeded rejections within a short window before notifying: a
// single one can occur transiently during a normal token refresh, but a
// genuinely expired session keeps emitting them as OWA retries its data calls.
let authNeededHits = [];
const recordAuthNeeded = (now = Date.now()) => {
  authNeededHits = authNeededHits.filter((t) => now - t < CONFIG.authNeededWindowMs);
  authNeededHits.push(now);
  return authNeededHits.length >= CONFIG.authNeededMinHits;
};

const startLoginCheck = () => {
  // Genuine session expiry: OWA's data layer rejects with AuthNeeded.
  window.addEventListener('unhandledrejection', (event) => {
    if (isAuthNeededRejection(event.reason) && recordAuthNeeded()) {
      reportLoginRequired('session-expired');
    }
  });

  // Hard redirect to a Microsoft sign-in page. Confirm it persists so a brief
  // SSO bounce during initial load doesn't fire a false notification: if the
  // page navigates on to Outlook, this script's context is gone and the timer
  // never runs.
  if (isOnLoginPage()) {
    setTimeout(() => {
      if (isOnLoginPage()) reportLoginRequired('login-page');
    }, CONFIG.loginPageConfirmMs);
  }
};

const observeUnreadHandlers = {
  outlookWebAppUnread: () => {
    // Find inbox element by semantic attribute (more stable than CSS classes)
    const inboxElement = document.querySelector('[data-folder-name="inbox"]');

    if (!inboxElement) {
      console.log(`No inbox element found for unread monitoring`);
      return false;
    }

    // Parse the unread count from a folder's title tooltip. Outlook localizes
    // the word ("unread"/"ungelesen"/"non lus"/...), but the count is always the
    // first number inside the parentheses, so match the digits after the opening
    // paren instead of the English word:
    //   "Inbox - 263 items (217 unread)" / "Posteingang - 263 Elemente (217 ungelesen)"
    // A folder with no unread messages omits the parenthetical (e.g.
    // "Action - 0 items"), so no match correctly yields 0.
    const parseUnread = (title) => {
      const match = title?.match(/\((\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // Resolve how many unread messages to report, per the user's setting:
    //   "inbox"     — the Inbox folder only (default, original behaviour)
    //   "favorites" — sum of unread across the pinned Favorites folders (#343)
    // Favorites live in one group anchored by the language-neutral internal id
    // "favoritesRoot"; each favourite folder is a treeitem below the level-1
    // "Favorites" header. Non-folder favourites (people, groups) have no
    // "(N unread)" tooltip and parse to 0, so they don't affect the sum.
    const getUnreadCount = () => {
      const source =
        (window.prospectMailConfig && window.prospectMailConfig.unreadNotificationSource) ||
        "inbox";

      if (source === "favorites") {
        const favorites = document.querySelectorAll(
          '[aria-labelledby="favoritesRoot"] [role="treeitem"]:not([aria-level="1"])'
        );
        let total = 0;
        favorites.forEach((el) => {
          total += parseUnread(el.getAttribute("title"));
        });
        return total;
      }

      return parseUnread(inboxElement.getAttribute("title"));
    };

    const checkUnread = (checkOnlyZeroUnread) => {
      if (!inboxElement) {
        console.log("Invalid inbox element");
        return false;
      }

      const unread = getUnreadCount();

      console.log(`Found ${unread} unread message(s)`);

      if (unread > 0 || !checkOnlyZeroUnread) {
        // Only push to the tray when the count actually changed. The periodic
        // timer and mutation observer both call this every few seconds; sending
        // an unchanged value makes Electron/Chromium re-publish the tray icon
        // (new temp dir + NewIcon signal) each time, which races the SNI host on
        // Wayland/appindicator and leaves the icon blank.
        if (unread !== lastUnreadCount) {
          window.electronAPI.updateUnread(unread);
        }

        // Only show notification if unread count increased
        if (unread > lastUnreadCount && !checkOnlyZeroUnread) {
          // Anti-spam: only show notification if enough time has passed
          const now = new Date();
          const timeSinceLastNotification = lastUnreadNotificationTime
            ? now - lastUnreadNotificationTime
            : Infinity;

          console.log('Unread notification check:', {
            unread,
            lastUnreadCount,
            timeSinceLastNotification,
            willShow: timeSinceLastNotification > CONFIG.unreadEmailThrottleMs
          });

          if (!lastUnreadNotificationTime || timeSinceLastNotification > CONFIG.unreadEmailThrottleMs) {
            if (window.prospectMailConfig && window.prospectMailConfig.showUnreadNotifications === false) {
              console.log('Unread notification suppressed by user setting (showUnreadNotifications=false)');
            } else {
              showNotification(
                "Prospect Mail: New Messages",
                `There are ${unread} unread messages.`
              );
              lastUnreadNotificationTime = now;
            }
          } else {
            console.log(`Unread notification suppressed by anti-spam (need to wait ${CONFIG.unreadEmailThrottleMs}ms)`);
          }
        }
      }

      // Update tracked count
      lastUnreadCount = unread;
    };

    // Find the navigation pane using semantic attribute (more stable than CSS classes)
    const navigationPane = document.querySelector('[data-app-section="NavigationPane"]');
    const leftPanel = navigationPane?.querySelector('#folderPaneDroppableContainer');

    if (!leftPanel) {
      console.log("Navigation panel not found for mutation observer");
      return false;
    }

    console.log("Successfully found inbox element and navigation panel");

    // Observe for DOM changes
    const observer = new MutationObserver(() => {
      debounce(checkUnread, CONFIG.mutationDebounceMs, "unread-mutation");
    });
    observer.observe(leftPanel, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    // Periodic safety net for changes the mutation observer might miss.
    // Runs a full check (checkOnlyZeroUnread=false) so it can also notify on a
    // real increase. Passing true here silently advanced lastUnreadCount without
    // notifying, so when the poll fired before the observer's debounced check a
    // newly-arrived mail was swallowed (see #415). The unread>lastUnreadCount
    // guard plus the anti-spam throttle still prevent duplicate notifications.
    if (unreadCheckTimer) {
      clearInterval(unreadCheckTimer);
    }
    unreadCheckTimer = setInterval(() => {
      checkUnread(false);
    }, CONFIG.unreadCheckIntervalMs);

    // Initial check
    checkUnread();

    return true;
  },

  outlookWebAppNotifications: () => {
    // Find notification pane by semantic attribute (more stable than CSS classes)
    const notificationPane = document.querySelector('[data-app-section="NotificationPane"]');

    if (!notificationPane) {
      console.log(`No notification pane found for calendar reminders`);
      return false;
    }

    console.log("Successfully found notification pane");

    const checkNotifications = (suppressNotification = false) => {
      if (!notificationPane) {
        console.log("Invalid notification pane element");
        return false;
      }

      // Query directly for reminder elements within the notification pane
      // More stable than using intermediate container class
      const reminderElements = notificationPane.querySelectorAll('[reminder]');
      const reminderCount = reminderElements.length;

      console.log(`Found ${reminderCount} calendar reminder(s)`);
      window.electronAPI.sendNotification(reminderCount > 0);

      // Only show notification if reminder count increased
      if (reminderCount > lastReminderCount && !suppressNotification) {
        // Anti-spam: only show notification if enough time has passed
        const now = new Date();
        const timeSinceLastNotification = lastCalendarNotificationTime
          ? now - lastCalendarNotificationTime
          : Infinity;

        console.log('Calendar notification check:', {
          reminderCount,
          lastReminderCount,
          timeSinceLastNotification,
          willShow: timeSinceLastNotification > CONFIG.calendarReminderThrottleMs
        });

        if (!lastCalendarNotificationTime || timeSinceLastNotification > CONFIG.calendarReminderThrottleMs) {
          const reminderDetails = [];
          reminderElements.forEach((reminder) => {
            const subject = reminder.getAttribute('subject') || 'Reminder';
            const timeDisplay = reminder.getAttribute('starttimedisplaystring') || '';
            const timeUntil = reminder.getAttribute('timeuntildisplaystring') || '';
            const location = reminder.getAttribute('location') || '';

            let details = subject;
            if (timeDisplay) details += ` at ${timeDisplay}`;
            if (timeUntil) details += ` (${timeUntil})`;
            if (location) details += ` - ${location}`;

            reminderDetails.push(details);
          });

          console.log('Showing calendar notification:', reminderDetails);
          showNotification(
            `Prospect Mail: ${reminderCount} Calendar Reminder${reminderCount > 1 ? 's' : ''}`,
            reminderDetails.join('\n')
          );
          lastCalendarNotificationTime = now;
        } else {
          console.log(`Calendar notification suppressed by anti-spam (need to wait ${CONFIG.calendarReminderThrottleMs}ms)`);
        }
      }

      // Update tracked count
      lastReminderCount = reminderCount;
    };

    // Observe for DOM changes
    const observer = new MutationObserver(() => {
      debounce(checkNotifications, CONFIG.mutationDebounceMs, "notification-mutation");
    });
    observer.observe(notificationPane, {
      childList: true,
      subtree: true,
    });

    // Initial check
    checkNotifications(true);

    return true;
  },
};

const initializeEmailMonitoring = () => {
  // Native Electron notifications don't require permission requests
  // The main process handles notification permissions

  const startedHandlers = [];
  const failedHandlers = [];

  for (const interfaceType in observeUnreadHandlers) {
    const handler = observeUnreadHandlers[interfaceType];
    const started = handler();

    if (started) {
      console.log(`Successfully connected to ${interfaceType} interface`);
      startedHandlers.push(interfaceType);
    } else {
      console.log(`Failed to connect to ${interfaceType} interface`);
      failedHandlers.push(interfaceType);
    }
  }

  // Retry failed handlers after a delay
  if (failedHandlers.length > 0) {
    console.log(`Retrying failed handlers in ${CONFIG.handlerRetryDelayMs / 1000} seconds: ${failedHandlers.join(', ')}`);
    setTimeout(() => {
      failedHandlers.forEach(interfaceType => {
        const handler = observeUnreadHandlers[interfaceType];
        const started = handler();
        if (started) {
          console.log(`Successfully connected to ${interfaceType} interface on retry`);
        } else {
          console.log(`${interfaceType} interface still not ready, will retry again`);
          // Keep retrying
          setTimeout(() => handler(), CONFIG.handlerRetryAgainDelayMs);
        }
      });
    }, CONFIG.handlerRetryDelayMs);
  }

  // If no handlers started at all, retry everything
  if (startedHandlers.length === 0) {
    console.log(`No interfaces ready yet, retrying all in ${CONFIG.handlerRetryDelayMs / 1000} seconds...`);
    setTimeout(initializeEmailMonitoring, CONFIG.handlerRetryDelayMs);
  }

  // Start watching for a session-expiry / sign-in-required state, independent
  // of the handler retries above, so a tray/minimized user gets notified.
  startLoginCheck();
};

const debounce = (() => {
  const timers = {};

  return (callback, wait, id = "default") => {
    if (timers[id]) {
      clearTimeout(timers[id]);
    }
    timers[id] = setTimeout(callback, wait);
  };
})();

// Auto-start only in the page (where this script is injected via
// executeJavaScript). In a Node test harness `window` is absent, so we skip the
// browser bootstrap and instead expose the detection helpers for unit tests.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializeEmailMonitoring();
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    isOnLoginPageUrl,
    isOnLoginPage,
    rejectionMessage,
    isAuthNeededRejection,
    recordAuthNeeded,
    reportLoginRequired,
    startLoginCheck,
    // Test hook: reset the module's login-detection state between scenarios.
    _resetLoginStateForTest() {
      loginRequiredReported = false;
      authNeededHits = [];
    },
  };
}
