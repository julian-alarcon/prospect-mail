const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script for the About window
 * Exposes safe APIs to the renderer process
 */
contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url) => {
    ipcRenderer.send("open-external-url", url);
  },
  closeWindow: () => {
    ipcRenderer.send("close-about-window");
  },
});
