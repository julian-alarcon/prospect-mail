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

  // Login-required detection
  loginRequiredInitialGraceMs: 30000, // don't detect login-required in the first 30s (avoids false positives during initial auth redirects)
  loginRequiredThresholdMs: 60000,   // 60s with no inbox after grace = likely logged out
  loginCheckIntervalMs: 30000,       // 30s between login-state checks
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

// ── Login-required detection ──────────────────────────────────────────────
// When the Outlook session expires the inbox DOM disappears (the page shows
// a sign-in screen or a stale-session banner). The existing handler retries
// cover slow loading, but if the inbox never appears we report it to the main
// process, which can auto-reload to recover via SSO or notify the user.
let loginRequiredReported = false;
let monitoringStartTime = Date.now();
let loginCheckInterval = null;

const LOGIN_URL_PATTERNS = [
  'login.microsoftonline.com',
  'login.live.com',
  'login.microsoft.com',
];

const isOnLoginPage = () => {
  try {
    const href = window.location.href;
    return LOGIN_URL_PATTERNS.some(p => href.includes(p));
  } catch {
    return false;
  }
};

const checkLoginRequired = () => {
  if (loginRequiredReported) return;
  const elapsed = Date.now() - monitoringStartTime;

  // Skip detection during the initial grace period to avoid false positives
  // from transient auth redirects when the page first loads.
  if (elapsed < CONFIG.loginRequiredInitialGraceMs) {
    return;
  }

  // Two distinct signals, reported with a reason so the main process can react
  // differently:
  //   'login-page' — we're sitting on a Microsoft sign-in page. The user must
  //     sign in manually; auto-reloading would wipe a half-entered form or break
  //     an MFA flow, so the main process only notifies for this case.
  //   'no-inbox'   — the page loaded but no inbox appeared for over the
  //     threshold (stuck/blank). SSO cookies may still be valid, so the main
  //     process reloads to attempt silent recovery.
  const onLoginPage = isOnLoginPage();
  if (onLoginPage || elapsed > CONFIG.loginRequiredThresholdMs) {
    const reason = onLoginPage ? 'login-page' : 'no-inbox';
    console.log('Login required detected, reporting to main process', {
      reason,
      elapsedMs: elapsed,
    });
    loginRequiredReported = true;
    window.electronAPI.reportLoginRequired(reason);
  }
};

const startLoginCheck = () => {
  if (loginCheckInterval) return;
  // Immediate check catches the definite login-page redirect without waiting.
  checkLoginRequired();
  loginCheckInterval = setInterval(() => {
    // If the inbox is present, we're logged in — stop checking.
    if (document.querySelector('[data-folder-name="inbox"]')) {
      console.log('Inbox found, user is logged in — stopping login check');
      clearInterval(loginCheckInterval);
      loginCheckInterval = null;
      return;
    }
    checkLoginRequired();
  }, CONFIG.loginCheckIntervalMs);
};

const observeUnreadHandlers = {
  outlookWebAppUnread: () => {
    // Find inbox element by semantic attribute (more stable than CSS classes)
    const inboxElement = document.querySelector('[data-folder-name="inbox"]');

    if (!inboxElement) {
      console.log(`No inbox element found for unread monitoring`);
      return false;
    }

    const checkUnread = (checkOnlyZeroUnread) => {
      if (!inboxElement) {
        console.log("Invalid inbox element");
        return false;
      }

      // Extract unread count from title attribute. Outlook localizes the word
      // ("unread"/"ungelesen"/"non lus"/...), but the count is always the first
      // number inside the parentheses, so match the digits after the opening
      // paren instead of the English word:
      //   "Inbox - 263 items (217 unread)" / "Posteingang - 263 Elemente (217 ungelesen)"
      // A folder with no unread messages omits the parenthetical, so no match
      // correctly yields 0.
      const title = inboxElement.getAttribute('title');
      const unreadMatch = title?.match(/\((\d+)/);
      const unread = unreadMatch ? parseInt(unreadMatch[1], 10) : 0;

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

  // Start monitoring for a login-required state. This is independent of the
  // handler retries above: if the inbox never appears (session expired), the
  // main process is notified so it can auto-reload or warn the user.
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

initializeEmailMonitoring();
