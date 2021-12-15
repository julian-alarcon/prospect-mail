setTimeout(() => {
    let unreadSpan = document.querySelector('._2iKri0mE1PM9vmRn--wKyI, ._n_J4._n_F4 .ms-fcl-tp');
    require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

    let observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            console.log('Observer Changed.');
            require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

            // Scrape messages and pop up a notification
            var messages = document.querySelectorAll('div[role="listbox"][aria-label="Message list"]');
            if (messages.length) {
                var unread = messages[0].querySelectorAll('div[aria-label^="Unread"]');
                var body = "";
                for (var i = 0; i < unread.length; i++) {
                    if (body.length) {
                        body += "\\n";
                    }
                    body += unread[i].getAttribute("aria-label").substring(7, 127);
                }
                if (unread.length) {
                    var notification = new Notification(unread.length + " New Messages", {
                        body: body,
                        icon: "assets/outlook_linux_black.png"
                    });
                    notification.onclick = () => {
                        require('electron').ipcRenderer.send('show');
                    };
                }
            }
        });
    });

    observer.observe(unreadSpan, { childList: true });

    // If the div containing reminders gets taller we probably got a new
    // reminder, so force the window to the top.
    let reminders = document.getElementsByClassName("_1BWPyOkN5zNVyfbTDKK1gM");
    let height = 0;
    let reminderObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (reminders[0].clientHeight > height) {
                require('electron').ipcRenderer.send('show');
            }
            height = reminders[0].clientHeight;
        });
    });

    if (reminders.length) {
        reminderObserver.observe(reminders[0], { childList: true });
    }

}, 10000);