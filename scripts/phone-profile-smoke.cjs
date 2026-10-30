// Launch with this project's Electron. Uses synthetic assertions, no tenant.
const { app, BrowserWindow, session, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'prospect-profile-test-'));
const helper = path.join(__dirname, '../vendor/electron-phone-passkey/scripts/fixtures/fake-passkey-helper.cjs');
fs.chmodSync(helper, 0o755);
process.env.PROSPECT_MAIL_USER_DATA_DIR = profile;
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({
  urlMainWindow: 'https://login.microsoftonline.com/test',
  phonePasskey: { enabled: true, helperPath: helper, extraOrigins: [] },
}));
let notifications = 0;
Notification.prototype.show = () => { notifications++; };
app.on('browser-window-created', (_event, win) => { win.show = () => {}; win.webContents.openDevTools = () => {}; });
app.on('ready', () => {
  session.defaultSession.protocol.handle('https', () => new Response(`<!doctype html><script>
    window.testResult = 'pending';
    navigator.credentials.get({publicKey:{challenge:new Uint8Array([1,2,3]),rpId:'login.microsoftonline.com',timeout:5000}})
      .then(c=>window.testResult=c instanceof PublicKeyCredential).catch(e=>window.testResult=e.name);
  </script>`, { headers: { 'Content-Type': 'text/html' } }));
});
const packageRoot = process.env.PROSPECT_PHONE_PACKAGE_ASAR;
require(packageRoot ? path.join(packageRoot, 'src/main.js') : '../src/main');
app.whenReady().then(async () => {
  const settings = require(packageRoot ? path.join(packageRoot, 'src/settings.js') : '../src/settings');
  assert.equal(app.getPath('userData'), profile);
  assert.equal(settings.get('phonePasskey.enabled'), true);
  assert.equal(settings.path, path.join(profile, 'settings.json'));
  await new Promise(r => setTimeout(r, 9500));
  const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('https://login.microsoftonline.com'));
  assert.ok(win);
  assert.equal(await win.webContents.executeJavaScript('window.testResult'), true);
  assert.equal(notifications, 0);
  console.log('PASS: actual Prospect startup selects isolated settings, enables phone sign-in, and initial login does not notify.');
  finish(0);
}).catch(e => { console.error(e.message); finish(1); });
const deadline = setTimeout(() => finish(1), 15000);

function finish(code) {
  clearTimeout(deadline);
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(code);
}
