let owa_timer;
const observeUnreadHandlers = {
  owa: () => {
    // Check the number of unread messages for Inbox Folder
    let unreadSpan = document.querySelector(".C2IG3.LPIso.oTkSL.iDEcr .o03Ce .BptzE.e0wpX.WIYG1 .WIYG1.Mt2TB");
    if (!unreadSpan) {
      console.log(`No notification found for owa`);
      return false;
    }
    let lastcheck;
    const checkOwa = (checkonlyzerounread) => {
      unreadSpan = document.querySelector(".C2IG3.LPIso.oTkSL.iDEcr .o03Ce .BptzE.e0wpX.WIYG1 .WIYG1.Mt2TB");
      let unread = 0;
      if (unreadSpan) {
        unread = parseInt(unreadSpan.textContent, 10);
      } else {
        unread = 0;
      }
      //unread = parseInt(unreadSpan.textContent, 10);
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
