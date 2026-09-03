const path = require("path");
const { nativeImage } = require("electron");
const settings = require("./settings");

const macOS = process.platform === "darwin";
const ASSETS_DIR = path.join(__dirname, "../assets");

// Tray assets per platform and unread state. The macOS pair is monochrome and
// is used as a template image so it follows the menu bar theme; both macOS
// files have @2x siblings that nativeImage picks up automatically.
const TRAY_ICONS = macOS
  ? { read: "outlook_macOS.png", unread: "outlook_macOS_unread.png" }
  : { read: "outlook_linux_black.png", unread: "outlook_linux_unread.png" };

// The window icon has never been platform-specific: the full-colour 64x64
// asset is what BrowserWindow uses everywhere.
const WINDOW_ICON = "outlook_linux_black.png";

// macOS menu bar height; a custom icon is arbitrary artwork and has to be
// shrunk to fit, unlike the 16px default assets.
const MAC_TRAY_SIZE = 16;
// The macOS dock renders large; anything smaller than this looks blurry.
const MIN_DOCK_SIZE = 128;

/**
 * The custom icon path as configured, without checking that it still resolves
 * to an image. Use this to decide whether the user has set a custom icon at
 * all (e.g. to enable "Reset to Default Icon"), so that a path which has gone
 * stale can still be cleared from the menu.
 */
function getConfiguredIconPath() {
  const custom = settings.get("appIcon");
  return typeof custom === "string" ? custom.trim() : "";
}

function hasCustomIcon() {
  return getConfiguredIconPath() !== "";
}

/**
 * The custom icon path, but only if it can actually be read as an image. A
 * file that was deleted or moved since it was picked must fall back to the
 * bundled icon rather than blank the tray.
 */
function getUsableIconPath() {
  const custom = getConfiguredIconPath();
  if (!custom) return "";
  if (nativeImage.createFromPath(custom).isEmpty()) {
    console.warn(`Custom app icon could not be read, using default: ${custom}`);
    return "";
  }
  return custom;
}

/** Tray image for the current unread state, honouring a custom icon. */
function getTrayIcon(isUnread) {
  const custom = getUsableIconPath();
  if (custom) {
    const image = nativeImage.createFromPath(custom);
    // Keep the user's own colours (no template image, which would flatten the
    // icon to a mask) and only scale it down for the macOS menu bar.
    return macOS
      ? image.resize({ width: MAC_TRAY_SIZE, height: MAC_TRAY_SIZE })
      : image;
  }

  const image = nativeImage.createFromPath(
    path.join(ASSETS_DIR, isUnread ? TRAY_ICONS.unread : TRAY_ICONS.read)
  );
  if (macOS) image.setTemplateImage(true);
  return image;
}

/** Window icon path (Windows/Linux only), honouring a custom icon. */
function getWindowIconPath() {
  return getUsableIconPath() || path.join(ASSETS_DIR, WINDOW_ICON);
}

/** macOS dock image for the custom icon, upscaled if the file is small. */
function getDockIcon() {
  const image = nativeImage.createFromPath(getWindowIconPath());
  return image.getSize().width < MIN_DOCK_SIZE
    ? image.resize({ width: MIN_DOCK_SIZE, height: MIN_DOCK_SIZE })
    : image;
}

module.exports = {
  getConfiguredIconPath,
  hasCustomIcon,
  getTrayIcon,
  getWindowIconPath,
  getDockIcon,
};
