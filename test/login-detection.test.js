// Unit tests for the session-expiry / sign-in detection in the injected
// unread observer. Regression coverage for #428: normal Mail/Calendar/Contacts
// use must never trigger a login-required report; only a genuinely expired
// session (repeated AuthNeeded rejections) or a persistent sign-in page should.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const MODULE_PATH = path.join(
  __dirname,
  "..",
  "public",
  "unread-number-observer.js"
);

// The observer exports its helpers only when `window` is absent at load time
// (the Node path). Require it once with no browser globals, then drive the
// helpers with a mocked window per test.
const observer = require(MODULE_PATH);

// Build a minimal browser-like environment and install it on globalThis so the
// module's free `window` references resolve to it at call time.
function mockWindow({ href = "https://outlook.office.com/mail/" } = {}) {
  const reported = [];
  const listeners = {};
  global.window = {
    location: { href },
    electronAPI: { reportLoginRequired: (r) => reported.push(r) },
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
  };
  global.document = {};
  return {
    reported,
    listeners,
    setHref: (h) => {
      global.window.location.href = h;
    },
    fireRejection: (reason) => {
      listeners.unhandledrejection?.({ reason });
    },
  };
}

test.afterEach(() => {
  observer._resetLoginStateForTest();
  delete global.window;
  delete global.document;
});

test("isOnLoginPageUrl matches only Microsoft sign-in hosts", () => {
  assert.strictEqual(
    observer.isOnLoginPageUrl("https://login.microsoftonline.com/common/oauth2"),
    true
  );
  assert.strictEqual(
    observer.isOnLoginPageUrl("https://login.live.com/oauth20_authorize.srf"),
    true
  );
  assert.strictEqual(
    observer.isOnLoginPageUrl("https://login.microsoft.com/foo"),
    true
  );
  assert.strictEqual(
    observer.isOnLoginPageUrl("https://outlook.office.com/mail/"),
    false
  );
  assert.strictEqual(
    observer.isOnLoginPageUrl("https://outlook.cloud.microsoft/people/"),
    false
  );
  assert.strictEqual(observer.isOnLoginPageUrl(""), false);
  assert.strictEqual(observer.isOnLoginPageUrl(null), false);
});

test("rejectionMessage extracts a string from varied reason shapes", () => {
  assert.strictEqual(observer.rejectionMessage("plain string"), "plain string");
  assert.strictEqual(
    observer.rejectionMessage(new Error("boom")),
    "boom"
  );
  assert.strictEqual(
    observer.rejectionMessage({ errorMessage: "custom field" }),
    "custom field"
  );
  assert.strictEqual(observer.rejectionMessage(null), "");
  assert.strictEqual(observer.rejectionMessage(undefined), "");
});

test("isAuthNeededRejection matches the AuthNeeded token exactly", () => {
  assert.strictEqual(
    observer.isAuthNeededRejection("GetFolderChangeDigest failed: AuthNeeded"),
    true
  );
  assert.strictEqual(
    observer.isAuthNeededRejection(new Error("StartSubscription failed: AuthNeeded")),
    true
  );
  // Case-sensitive, whole-token: unrelated words must not match.
  assert.strictEqual(observer.isAuthNeededRejection("authneeded"), false);
  assert.strictEqual(observer.isAuthNeededRejection("AuthNeededExtra"), false);
  assert.strictEqual(
    observer.isAuthNeededRejection("ResizeObserver loop limit exceeded"),
    false
  );
  assert.strictEqual(observer.isAuthNeededRejection(null), false);
});

test("recordAuthNeeded requires minHits within the window", () => {
  const base = 1_000_000;
  // First hit is below the threshold.
  assert.strictEqual(observer.recordAuthNeeded(base), false);
  // Second hit inside the window reaches minHits (2).
  assert.strictEqual(observer.recordAuthNeeded(base + 1000), true);
});

test("recordAuthNeeded forgets hits older than the window", () => {
  const base = 1_000_000;
  assert.strictEqual(observer.recordAuthNeeded(base), false);
  // A hit past the window drops the stale one, so this counts as the first.
  const afterWindow = base + observer.CONFIG.authNeededWindowMs + 1;
  assert.strictEqual(observer.recordAuthNeeded(afterWindow), false);
});

test("normal use (no AuthNeeded, not a login page) never reports", () => {
  // Covers Mail, Calendar, and Contacts: there is no DOM heuristic anymore, so
  // benign rejections on any view must stay silent (the #428 regression).
  for (const href of [
    "https://outlook.office.com/mail/",
    "https://outlook.office.com/calendar/",
    "https://outlook.cloud.microsoft/people/",
  ]) {
    const env = mockWindow({ href });
    observer.startLoginCheck();
    env.fireRejection("ResizeObserver loop limit exceeded");
    env.fireRejection(new Error("Some unrelated network blip"));
    assert.deepStrictEqual(env.reported, [], `should stay silent on ${href}`);
    observer._resetLoginStateForTest();
    delete global.window;
    delete global.document;
  }
});

test("a single AuthNeeded rejection does not report", () => {
  const env = mockWindow();
  observer.startLoginCheck();
  env.fireRejection("GetFolderChangeDigest failed: AuthNeeded");
  assert.deepStrictEqual(env.reported, []);
});

test("repeated AuthNeeded rejections report session-expired once", () => {
  const env = mockWindow();
  observer.startLoginCheck();
  env.fireRejection("GetFolderChangeDigest failed: AuthNeeded");
  env.fireRejection(new Error("StartSubscription failed: AuthNeeded"));
  assert.deepStrictEqual(env.reported, ["session-expired"]);
  // Further rejections must not re-notify.
  env.fireRejection("GetConversationItems failed: AuthNeeded");
  assert.deepStrictEqual(env.reported, ["session-expired"]);
});

test("a persistent sign-in page reports login-page", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const env = mockWindow({
    href: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  });
  observer.startLoginCheck();
  assert.deepStrictEqual(env.reported, []); // not until it persists
  t.mock.timers.tick(observer.CONFIG.loginPageConfirmMs);
  assert.deepStrictEqual(env.reported, ["login-page"]);
});

test("a transient sign-in bounce does not report login-page", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const env = mockWindow({
    href: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  });
  observer.startLoginCheck();
  // SSO bounces back to Outlook before the confirm delay elapses.
  env.setHref("https://outlook.office.com/mail/");
  t.mock.timers.tick(observer.CONFIG.loginPageConfirmMs);
  assert.deepStrictEqual(env.reported, []);
});
