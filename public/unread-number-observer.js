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

      // Extract unread count from title attribute: "Inbox - 263 items (217 unread)"
      const title = inboxElement.getAttribute('title');
      const unreadMatch = title?.match(/\((\d+)\s+unread\)/);
      const unread = unreadMatch ? parseInt(unreadMatch[1], 10) : 0;

      console.log(`Found ${unread} unread message(s)`);

      if (unread > 0 || !checkOnlyZeroUnread) {
        window.electronAPI.updateUnread(unread);

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
            showNotification(
              "Prospect Mail: New Messages",
              `There are ${unread} unread messages.`
            );
            lastUnreadNotificationTime = now;
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

    // Timer to catch zero unread changes that observer might miss
    if (unreadCheckTimer) {
      clearInterval(unreadCheckTimer);
    }
    unreadCheckTimer = setInterval(() => {
      checkUnread(true);
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
