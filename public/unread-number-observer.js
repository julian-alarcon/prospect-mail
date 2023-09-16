let owa_timer;
const observeUnreadHandlers = {
  owa: () => {
    // Check the number of unread messages for Inbox Folder
    const unreadSpan = document.querySelector(".C2IG3.LPIso.oTkSL.iDEcr .o03Ce .BptzE.e0wpX.WIYG1 .WIYG1.Mt2TB");
    if (!unreadSpan) {
      console.log(`No notification found for owa`);
      return false;
    }
    let lastcheck;
    const checkOwa = (checkonlyzerounread) => {
      if (unreadSpan) {
        let unread = parseInt(unreadSpan.textContent, 10);
        console.log(unread);
      } else {
        console.log("Not a valid number for unread messages.");
        return false;
      }
      unread = parseInt(unreadSpan.textContent, 10);
      if (unread > 0 || !checkonlyzerounread) {
        require("electron").ipcRenderer.send("updateUnread", unread);

        if (unread > 0 && !checkonlyzerounread) {
          //do not spam notification
          if (!lastcheck || new Date() - lastcheck > 500) {
            console.log(new Date());
            console.log(lastcheck);
            console.log(new Date() - lastcheck);
            if (!document.hasFocus()) {
              var notification = new Notification("Prospect Mail: New Messages", {
                body: "There are " + unread + " unread messages.",
                icon: "assets/outlook_linux_black.png",
              });
              notification.onclick = () => {
                require("electron").ipcRenderer.send("show");
              };
            }
            lastcheck = new Date();
          }
        }
      }
    };

    const leftPanel = document.querySelector(".slWCo.ou4TM");
    console.log("Begin observe leftPanel: ", leftPanel);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        waitForFinalEvent(checkOwa, 1000, "mutation detected");
      });
    });

    observer.observe(leftPanel, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    //observer cannot catch all changes, use timer to handle ZERO unreadmessages
    if (owa_timer) {
      clearInterval(owa_timer);
    }
    owa_timer = setInterval(() => {
      checkOwa(true);
    }, 5000);

    checkOwa();

    return true; //successfully attached
  },

  // @joax implementation, maybe this is an update or consumer
  consumer_2: () => {
    let unreadSpan = document.querySelector(".ki0YS.bSYaw_");
    if (!unreadSpan) {
      console.log(`No notification found for Calendars/Alerts`);
      return false;
    }
    require("electron").ipcRenderer.send(
      "updateUnread",
      unreadSpan.hasChildNodes()
    );
    console.log(unreadSpan, unreadSpan.hasChildNodes());
    let observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log("Observer Changed.");
        require("electron").ipcRenderer.send(
          "updateUnread",
          unreadSpan.hasChildNodes()
        );
        // Scrape messages and pop up a notification
        var messages = document.querySelectorAll(
          'div[aria-label] [role="listbox"]'
        );
        if (messages.length) {
          console.log("Unread messages found");
          //we need to be multilanguage
          var unread =
            messages[0].querySelectorAll('div[aria-label^="Unread"]') ||
            messages[0].querySelectorAll('div[aria-label^="Da leggere"]');
          var body = "";
          for (var i = 0; i < unread.length; i++) {
            if (body.length) {
              body += "\\n";
            }
            body += unread[i].getAttribute("aria-label").substring(7, 127);
          }
          if (unread.length) {
            var notification = {
              title: "Outlook (" + unread.length + ") new messages",
              subtitle: "You have new messages in your inbox",
              body: body,
              icon: "assets/outlook_linux_black.png",
            };
            // Show system notification
            require("electron").ipcRenderer.send(
              "unread-messages-notification",
              notification
            );
          }
        }
      });
    });
    observer.observe(unreadSpan, { childList: true });
    // If the div containing reminders gets taller we probably got a new
    // reminder, so force the window to the top.
    let reminders = document.getElementsByClassName(".ki0YS.bSYw_");
    console.log(reminders);
    let height = 0;
    let reminderObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (reminders[0].clientHeight > height) {
          require("electron").ipcRenderer.send("show");
        }
        height = reminders[0].clientHeight;
      });
    });
    if (reminders.length) {
      reminderObserver.observe(reminders[0], { childList: true });
    }
    return true; //successfully attached
  },
};

const observeUnreadInit = () => {
  let found = false;
  for (const handlername in observeUnreadHandlers) {
    const handler = observeUnreadHandlers[handlername];
    found = handler();
    if (found) {
      console.log(`Handler %o attached.`, handlername);
      //handler found no need to cycle again
      break;
    }
  }
  if (!found) {
    console.log("Missing valid handler, try again in 5 seconds");
    setTimeout(observeUnreadInit, 5000);
    return;
  }
};

var waitForFinalEvent = (function () {
  var timers = {};
  return function (callback, ms, uniqueId) {
    if (!uniqueId) {
      uniqueId = "Don't call this twice without a uniqueId";
    }
    if (timers[uniqueId]) {
      clearTimeout(timers[uniqueId]);
    }
    timers[uniqueId] = setTimeout(callback, ms);
  };
})();

observeUnreadInit();
