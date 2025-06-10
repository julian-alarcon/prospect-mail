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
              var notification = new Notification("Outlook Mail", {
                body: unread + " nouveaux messages.",
                icon: "data:image/png;base64,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",
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
