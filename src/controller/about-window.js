const { BrowserWindow, app, shell, ipcMain } = require("electron");
const path = require("path");

let aboutWindow = null;

/**
 * Opens the About window
 * Creates a new window if it doesn't exist, or focuses the existing one
 */
function openAboutWindow() {
  // If window already exists, focus it
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }

  const version = app.getVersion();
  const githubUrl = "https://github.com/julian-alarcon/prospect-mail";
  const donateUrl = "https://github.com/sponsors/julian-alarcon";

  aboutWindow = new BrowserWindow({
    width: 450,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    title: "About Prospect Mail",
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "about-preload.js"),
    },
  });

  // Build URL with query parameters for version and links
  const htmlPath = path.join(__dirname, "../about.html");
  const params = new URLSearchParams({
    version: version,
    github: githubUrl,
    donate: donateUrl,
  });

  aboutWindow.loadFile(htmlPath, {
    search: params.toString(),
  });

  // Handle IPC messages for opening external links
  ipcMain.on("open-external-url", (_event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on("close-about-window", () => {
    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.close();
    }
  });

  // Open external links in default browser
  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Clean up reference when window is closed
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
}

module.exports = { openAboutWindow };
