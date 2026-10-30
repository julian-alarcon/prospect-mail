const test = require('node:test');
const assert = require('node:assert/strict');
const { LoginNotificationPolicy } = require('../src/login-notification-policy');

test('initial sign-in and visible authentication never notify', () => {
  const policy = new LoginNotificationPolicy();
  assert.equal(policy.shouldNotify('login-page', { visible: false, now: 0 }), false);
  assert.equal(policy.shouldNotify('session-expired', { visible: true, now: 0 }), false);
  policy.markMailboxReady();
  assert.equal(policy.shouldNotify('login-page', { visible: true, now: 0 }), false);
  assert.equal(policy.shouldNotify('session-expired', { visible: true, now: 0 }), false);
  assert.equal(policy.shouldNotify('unknown', { visible: false, now: 0 }), false);
});

test('hidden expired sessions notify once across repeated login documents', () => {
  const policy = new LoginNotificationPolicy();
  policy.markMailboxReady();
  assert.equal(policy.shouldNotify('login-page', { visible: false, now: 0 }), true);
  assert.equal(policy.shouldNotify('login-page', { visible: false, now: 240000 }), false);
  assert.equal(policy.shouldNotify('session-expired', { visible: false, now: 240000 }), false);
  policy.markMailboxReady();
  assert.equal(policy.shouldNotify('session-expired', { visible: false, now: 240000 }), true);
});

test('a rapidly recovering session cannot repeatedly notify', () => {
  const policy = new LoginNotificationPolicy();
  policy.markMailboxReady();
  assert.equal(policy.shouldNotify('session-expired', { visible: false, now: 0 }), true);
  policy.markMailboxReady();
  assert.equal(policy.shouldNotify('session-expired', { visible: false, now: 1000 }), false);
  assert.equal(policy.shouldNotify('session-expired', { visible: false, now: 180000 }), true);
});

// Exercise the actual observer and policy together, with no folder DOM.
test('repeated AuthNeeded on Calendar can notify without an inbox and stays deduplicated after navigation', () => {
  const observer = require('../public/unread-number-observer');
  const policy = new LoginNotificationPolicy();
  const reported = [];
  const listeners = {};
  global.document = { querySelector: () => null };
  global.window = {
    location: { href: 'https://outlook.cloud.microsoft/calendar/' },
    addEventListener: (name, listener) => { listeners[name] = listener; },
    electronAPI: { reportLoginRequired: reason => {
      if (policy.shouldNotify(reason, { visible: false, now: 0 })) reported.push(reason);
    } },
  };
  try {
    observer.startLoginCheck();
    listeners.unhandledrejection({ reason: new Error('GetFolder failed: AuthNeeded') });
    assert.deepEqual(reported, []);
    listeners.unhandledrejection({ reason: new Error('StartSubscription failed: AuthNeeded') });
    assert.deepEqual(reported, ['session-expired']);
    assert.equal(policy.hasMailSession, false);
    observer._resetLoginStateForTest();
    observer.startLoginCheck();
    listeners.unhandledrejection({ reason: new Error('GetFolder failed: AuthNeeded') });
    listeners.unhandledrejection({ reason: new Error('StartSubscription failed: AuthNeeded') });
    assert.deepEqual(reported, ['session-expired']);
  } finally {
    observer._resetLoginStateForTest();
    delete global.window;
    delete global.document;
  }
});
