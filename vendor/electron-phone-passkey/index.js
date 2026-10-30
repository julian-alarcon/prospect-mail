const path = require("node:path");
const fs = require("node:fs");
const { allowedOrigins, frameContext, validateRequest } = require("./policy");
const { runBackend } = require("./backend");

const CHANNELS = {
  config: "phone-passkey:config",
  get: "phone-passkey:get",
  cancel: "phone-passkey:cancel",
  promptCancel: "phone-passkey:prompt-cancel",
};

function createPhonePasskeySupport({ electron, helperPath, extraOrigins = [] }) {
  const { ipcMain, BrowserWindow } = electron;
  if (!path.isAbsolute(helperPath || "")) throw new Error("Configure an absolute phone-passkey helper path.");
  fs.accessSync(helperPath, fs.constants.X_OK);
  const origins = allowedOrigins(extraOrigins);
  const contents = new Set();
  const sessions = new Map();
  const active = new Map();
  const listeners = new Map();
  let disposed = false;

  const context = (event) => {
    if (!contents.has(event.sender) || event.sender.isDestroyed()) throw new Error("Unregistered window.");
    return frameContext(event.senderFrame, origins);
  };
  const keyFor = (event) => `${event.sender.id}:${event.senderFrame?.processId}:${event.senderFrame?.routingId}`;

  // Synchronous, credential-free configuration for document-start preloads.
  const configHandler = (event) => {
    try {
      context(event);
      event.returnValue = { enabled: true };
    } catch {
      event.returnValue = null;
    }
  };
  ipcMain.on(CHANNELS.config, configHandler);

  // Direct frame IPC: the caller cannot supply or override its signing origin.
  ipcMain.handle(CHANNELS.get, async (event, input) => {
    let caller;
    let timeout;
    try {
      caller = context(event);
      timeout = validateRequest(input);
    } catch {
      return { ok: false, error: { name: "SecurityError", message: "This passkey request is not allowed." } };
    }
    const key = keyFor(event);
    if (active.has(key)) return { ok: false, error: { name: "InvalidStateError", message: "A phone sign-in is already in progress." } };
    const controller = new AbortController();
    let prompt;
    const pending = { id: input.id, controller, sender: event.sender, frame: event.senderFrame };
    active.set(key, pending);
    const showQr = (svg) => {
      if (!prompt) {
        prompt = new BrowserWindow({
          width: 430, height: 620, resizable: false, show: false,
          autoHideMenuBar: true,
          backgroundColor: electron.nativeTheme?.shouldUseDarkColors ? "#1e1f22" : "#ffffff",
          parent: BrowserWindow.fromWebContents(event.sender) || undefined,
          title: "Sign in with your phone",
          webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false,
            partition: "phone-passkey-prompt", preload: path.join(__dirname, "prompt-preload.js") },
        });
        pending.prompt = prompt;
        prompt.setMenu(null);
        prompt.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        prompt.webContents.on("will-navigate", (e) => e.preventDefault());
        prompt.on("closed", () => controller.abort());
        prompt.webContents.once("did-finish-load", () => {
          if (!prompt.isDestroyed()) {
            prompt.webContents.send("phone-passkey:qr", { svg, origin: caller.origin });
            prompt.show();
          }
        });
        void prompt.loadFile(path.join(__dirname, "prompt.html")).catch(() => controller.abort());
      }
    };
    try {
      const credential = await runBackend({ helperPath,
        request: { ...caller, publicKey: { ...input.publicKey, timeout } }, timeout,
        signal: controller.signal, onQr: showQr });
      // Navigation can invalidate a frame while the phone is answering.
      const current = context(event);
      if (current.origin !== caller.origin || current.topOrigin !== caller.topOrigin) {
        throw Object.assign(new Error("The sign-in page changed."), { name: "AbortError" });
      }
      return { ok: true, credential };
    } catch (error) {
      return { ok: false, error: { name: error.name || "NotAllowedError", message: error.message } };
    } finally {
      active.delete(key);
      if (prompt && !prompt.isDestroyed()) prompt.destroy();
    }
  });

  const cancelHandler = (event, id) => {
    const pending = active.get(keyFor(event));
    if (pending?.id === id && pending.sender === event.sender) pending.controller.abort();
  };
  // Cancel only the request belonging to this exact window and frame.
  ipcMain.on(CHANNELS.cancel, cancelHandler);
  const promptCancelHandler = (event) => {
    for (const pending of active.values()) {
      if (pending.prompt?.webContents === event.sender) pending.controller.abort();
    }
  };
  // Only the local QR window can cancel its associated native operation.
  ipcMain.on(CHANNELS.promptCancel, promptCancelHandler);

  return {
    attach(webContents) {
      if (disposed) throw new Error("Phone-passkey support has been disposed.");
      if (contents.has(webContents)) return;
      contents.add(webContents);
      const session = webContents.session;
      if (!sessions.has(session)) {
        const id = session.registerPreloadScript({ type: "frame", filePath: path.join(__dirname, "preload.js") });
        sessions.set(session, id);
      }
      const abortRequests = () => {
        for (const pending of active.values()) if (pending.sender === webContents) pending.controller.abort();
      };
      const onNavigation = (_event, _url, inPlace, isMainFrame, processId, routingId) => {
        // Hash/history changes keep the calling document and ceremony alive.
        if (inPlace) return;
        for (const pending of active.values()) {
          if (pending.sender === webContents && (isMainFrame ||
              pending.frame.processId === processId && pending.frame.routingId === routingId)) pending.controller.abort();
        }
      };
      const onDestroyed = () => {
        abortRequests();
        detach(webContents);
        contents.delete(webContents);
      };
      listeners.set(webContents, { onNavigation, abortRequests, onDestroyed });
      webContents.on("did-start-navigation", onNavigation);
      webContents.on("render-process-gone", abortRequests);
      webContents.once("destroyed", onDestroyed);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pending of active.values()) pending.controller.abort();
      for (const webContents of listeners.keys()) detach(webContents);
      for (const [session, id] of sessions) session.unregisterPreloadScript(id);
      sessions.clear();
      ipcMain.removeHandler(CHANNELS.get);
      ipcMain.removeListener(CHANNELS.config, configHandler);
      ipcMain.removeListener(CHANNELS.cancel, cancelHandler);
      ipcMain.removeListener(CHANNELS.promptCancel, promptCancelHandler);
      contents.clear();
    },
  };

  function detach(webContents) {
    const attached = listeners.get(webContents);
    if (!attached) return;
    webContents.removeListener("did-start-navigation", attached.onNavigation);
    webContents.removeListener("render-process-gone", attached.abortRequests);
    webContents.removeListener("destroyed", attached.onDestroyed);
    listeners.delete(webContents);
  }
}

module.exports = { createPhonePasskeySupport, CHANNELS };
