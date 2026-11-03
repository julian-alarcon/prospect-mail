const { app } = require("electron");
const fs = require("fs");
const settings = require("./settings");
const { argsWithSwitch, argsWithoutSwitch } = require("./compat-args");

// Compatibility switches that configure the Chromium/Blink engine itself.
// They are exposed as GUI toggles in the tray menu (Settings > Compatibility)
// so a user never has to discover the right command-line flag.

const OZONE_SWITCH = "ozone-platform";
const RELAUNCH_ENV = "PROSPECT_MAIL_RELAUNCHED";

// Returns true when the process is about to exit for a self-relaunch, in
// which case the caller must not continue starting the app.
function applyCompatibilitySwitches() {
  // Passkeys (WebAuthn) have no UI in Electron on Linux, so Microsoft's
  // passkey-first sign-in page never completes. Removing the WebAuthn API
  // makes the sign-in page fall back to a password prompt. Blink features can
  // still be changed at this point, so a plain switch is enough.
  if (settings.get("disableWebAuthn")) {
    appendListSwitch("disable-blink-features", "WebAuth");
    console.log("[Compat] WebAuthn/passkeys disabled (disableWebAuthn)");
  }

  // Rendering backend. Electron picks native Wayland when available, but on
  // NVIDIA + Wayland the GPU process crashes repeatedly and Chromium falls
  // back to slow software rendering; running through XWayland keeps hardware
  // acceleration. The ozone platform is fixed before main.js runs, so
  // app.commandLine.appendSwitch() is too late: the flag has to be a real
  // process argument. Relaunch once with it when needed.
  const backend = effectiveRenderingBackend();
  const current = app.commandLine.getSwitchValue(OZONE_SWITCH);
  if (backend && current !== backend) {
    if (process.env[RELAUNCH_ENV]) {
      console.warn(`[Compat] Could not switch to ${backend} backend after relaunch, giving up`);
    } else {
      console.log(`[Compat] Relaunching with ${backend} rendering backend (renderingBackend=${settings.get("renderingBackend")})`);
      process.env[RELAUNCH_ENV] = "1";
      app.relaunch({ args: argsWithSwitch(process.argv.slice(1), OZONE_SWITCH, backend) });
      app.exit(0);
      return true;
    }
  } else if (backend) {
    console.log(`[Compat] Using ${backend} rendering backend`);
  }
  return false;
}

// "auto" | "wayland" | "x11" -> the ozone platform to enforce, or null to
// leave Electron's own choice alone.
function effectiveRenderingBackend() {
  if (process.platform !== "linux") return null;
  const setting = settings.get("renderingBackend");
  if (setting === "x11" || setting === "wayland") return setting;
  // auto: respect an explicit --ozone-platform from the user, otherwise avoid
  // native Wayland on NVIDIA. Electron itself adds the switch to
  // app.commandLine early on, so look at the real process arguments.
  if (userPassedSwitch(OZONE_SWITCH) && !process.env[RELAUNCH_ENV]) return null;
  if (isWaylandSession() && hasNvidiaDriver()) return "x11";
  return null;
}

function userPassedSwitch(name) {
  return process.argv
    .slice(1)
    .some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
}

function isWaylandSession() {
  return (
    process.env.XDG_SESSION_TYPE === "wayland" || Boolean(process.env.WAYLAND_DISPLAY)
  );
}

function hasNvidiaDriver() {
  return fs.existsSync("/sys/module/nvidia") || fs.existsSync("/proc/driver/nvidia/version");
}

// Restart the app for a compatibility change. The backend flag we may have
// added on a previous self-relaunch is dropped so the new process derives it
// from the current setting again.
function relaunchApp() {
  app.relaunch({ args: argsWithoutSwitch(process.argv.slice(1), OZONE_SWITCH) });
  app.exit(0);
}

// Append a value to a comma-separated Chromium switch without clobbering a
// value the user already passed on the command line.
function appendListSwitch(name, value) {
  const current = app.commandLine.getSwitchValue(name);
  const values = current ? current.split(",").filter(Boolean) : [];
  if (!values.includes(value)) values.push(value);
  app.commandLine.appendSwitch(name, values.join(","));
}

module.exports = { applyCompatibilitySwitches, relaunchApp };
