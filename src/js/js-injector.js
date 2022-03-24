class JsInjector {

}

JsInjector.childWindow = `
setTimeout(() => {
    let removeTopBar = ['to-do.office.com/tasks']
    let url = window.location;
    
    // Remove Top Bar
    if (new RegExp(removeTopBar.join('|')).test(url)) {
        var topBar = document.querySelectorAll('#O365ShellHeader')
        topBar[0].style.display = 'none';   
    } 

    // Close Button
    let closeButton = document.createElement('div');
    
    closeButton.className = 'ms-Button';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '0px';
    closeButton.style.top = '0px'; 
    closeButton.style.lineHeight = '35px';
    closeButton.style.width = '35px';
    closeButton.style.height = '35px';
    closeButton.style.background = 'rgba(0,0,0,0.3)';
    closeButton.style.textAlign = 'center';
    closeButton.style.color = 'white';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';

    closeButton.append('✖');

    closeButton.addEventListener('click', () => {
        window.close();
    }); 

    document.body.append(closeButton);

}, 3000);
`

JsInjector.main = `
setTimeout(() => {
    let unreadSpan = document.querySelector('.rh6W3beKQeO3YL0Rsylg');
    require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

    let observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            console.log('Observer Changed.');
            require('electron').ipcRenderer.send('updateUnread', unreadSpan.hasChildNodes());

            // Scrape messages and pop up a notification
            var messages = document.querySelectorAll('div[aria-label="Message list"] [role="listbox"]');
            if (messages.length)
            {
                console.log('Unread messages found');
                var unread = messages[0].querySelectorAll('div[aria-label^="Unread"]');
                var body = "";
                for (var i = 0; i < unread.length; i++)
                {
                    if (body.length)
                    {
                        body += "\\n";
                    }
                    body += unread[i].getAttribute("aria-label").substring(7, 127);
                }
                if (unread.length)
                {
                    var notification = {
                        title: "Outlook (" + unread.length + ") new messages",
                        subtitle: "You have new messages in your inbox",
                        body: body,
                        icon: "assets/outlook_linux_black.png"
                    };

                    // Show system notification
                    require('electron').ipcRenderer.send('unread-messages-notification', notification);
                }
            }
        });
    });

    observer.observe(unreadSpan, {childList: true});

    // If the div containing reminders gets taller we probably got a new
    // reminder, so force the window to the top.
    let reminders = document.getElementsByClassName("_3PvwGqXAizENgzsKVa_JPJ");
    let height = 0;
    let reminderObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (reminders[0].clientHeight > height)
            {
                require('electron').ipcRenderer.send('show');
            }
            height = reminders[0].clientHeight;
        });
    });

    if (reminders.length) {
        reminderObserver.observe(reminders[0], { childList: true });
    }

    // Open Teams
    $("#owaMeetNowButton").unbind();
    $("#owaMeetNowButton").on("click", (e) => {
        e.preventDefault();
        require("electron").ipcRenderer.send('schedule-teams')
    })
    

}, 10000);
`

module.exports = JsInjector;