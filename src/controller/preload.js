const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  updateUnread: (unread) => ipcRenderer.send("updateUnread", unread),
  showWindow: () => ipcRenderer.send("show"),
  sendNotification: (notification) =>
    ipcRenderer.send("unread-messages-notification", notification),
  showNotification: (title, body, icon = null) =>
    ipcRenderer.send("show-notification", { title, body, icon }),
});
