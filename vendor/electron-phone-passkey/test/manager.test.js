const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { createPhonePasskeySupport, CHANNELS } = require("..");

test("IPC authenticates registered frames and ignores renderer-supplied origins", async () => {
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (channel, handler) => handlers.set(channel, handler);
  ipcMain.removeHandler = (channel) => handlers.delete(channel);
  let registered = 0;
  let unregistered = 0;
  const session = {
    registerPreloadScript: () => { registered++; return "test-preload"; },
    unregisterPreloadScript: () => { unregistered++; },
  };
  const contents = Object.assign(new EventEmitter(), { id: 1, session, isDestroyed: () => false });
  const frame = { url: "https://login.microsoftonline.com/test", processId: 1, routingId: 2, parent: null };
  frame.top = frame;
  const event = { sender: contents, senderFrame: frame };
  const helper = path.join(__dirname, "../scripts/fixtures/fake-passkey-helper.cjs");
  fs.chmodSync(helper, 0o755);
  const support = createPhonePasskeySupport({ electron: { ipcMain, BrowserWindow: {} }, helperPath: helper });
  const get = handlers.get(CHANNELS.get);
  const request = { id: "request", origin: "https://evil.example", publicKey: { challenge: "AQID", timeout: 3000 } };
  try {
    assert.equal((await get(event, request)).error.name, "SecurityError");
    support.attach(contents);
    support.attach(contents);
    assert.equal(registered, 1);
    ipcMain.emit(CHANNELS.config, event);
    assert.equal(event.returnValue.enabled, true);
    const result = await get(event, request);
    assert.equal(result.ok, true);
    const client = JSON.parse(Buffer.from(result.credential.response.clientDataJSON, "base64url"));
    assert.equal(client.origin, "https://login.microsoftonline.com");
    frame.url = "https://evil.example/test";
    assert.equal((await get(event, request)).error.name, "SecurityError");
    ipcMain.emit(CHANNELS.config, event);
    assert.equal(event.returnValue, null);
    frame.url = "https://login.microsoftonline.com/test";
    contents.emit("destroyed");
    assert.equal((await get(event, request)).error.name, "SecurityError");
  } finally {
    support.dispose();
  }
  assert.equal(unregistered, 1);
  assert.equal(handlers.size, 0);
  assert.equal(ipcMain.listenerCount(CHANNELS.config), 0);
});

function lifecycleFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "prospect-lifecycle-"));
  const helperPath = path.join(directory, "helper");
  fs.writeFileSync(helperPath, `#!${process.execPath}\nsetTimeout(() => {}, 10000);`, { mode: 0o755 });
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (channel, handler) => handlers.set(channel, handler);
  ipcMain.removeHandler = (channel) => handlers.delete(channel);
  let registered = 0;
  let unregistered = 0;
  const session = {
    registerPreloadScript: () => `preload-${++registered}`,
    unregisterPreloadScript: () => unregistered++,
  };
  const contents = Object.assign(new EventEmitter(), { id: 2, session, isDestroyed: () => false });
  const frame = { url: "https://login.microsoftonline.com/signin", processId: 3, routingId: 4, parent: null };
  frame.top = frame;
  const event = { sender: contents, senderFrame: frame };
  const electron = { ipcMain, BrowserWindow: {} };
  const support = createPhonePasskeySupport({ electron, helperPath });
  support.attach(contents);
  t.after(() => { support.dispose(); fs.rmSync(directory, { recursive: true, force: true }); });
  return {
    support, contents, electron, helperPath,
    counts: () => ({ registered, unregistered }),
    begin: () => handlers.get(CHANNELS.get)(event, {
      id: "lifecycle", publicKey: { challenge: "AQID", timeout: 3000 },
    }),
  };
}

const linux = { skip: process.platform !== "linux" && "Phone helper tests require Linux" };

test("same-document navigation preserves the assertion; document replacement cancels it", linux, async (t) => {
  const { begin, contents } = lifecycleFixture(t);
  const pending = begin();
  contents.emit("did-start-navigation", {}, "https://login.microsoftonline.com/signin#progress", true, true, 3, 4);
  const status = await Promise.race([
    pending.then(() => "settled"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 30)),
  ]);
  assert.equal(status, "pending");
  contents.emit("did-start-navigation", {}, "https://login.microsoftonline.com/next", false, true, 3, 4);
  assert.equal((await pending).error.name, "AbortError");
});

test("dispose aborts pending work, removes listeners and permits clean replacement", linux, async (t) => {
  const { support, begin, contents, electron, helperPath, counts } = lifecycleFixture(t);
  const pending = begin();
  support.dispose();
  support.dispose();
  assert.equal((await pending).error.name, "AbortError");
  for (const name of ["did-start-navigation", "render-process-gone", "destroyed"]) {
    assert.equal(contents.listenerCount(name), 0);
  }
  assert.deepEqual(counts(), { registered: 1, unregistered: 1 });
  assert.throws(() => support.attach(contents), /disposed/);
  const replacement = createPhonePasskeySupport({ electron, helperPath });
  t.after(() => replacement.dispose());
  replacement.attach(contents);
  assert.equal(contents.listenerCount("did-start-navigation"), 1);
  replacement.dispose();
  assert.equal(contents.listenerCount("did-start-navigation"), 0);
  assert.deepEqual(counts(), { registered: 2, unregistered: 2 });
});

test("destroying a registered window aborts its assertion and releases listeners", linux, async (t) => {
  const { begin, contents } = lifecycleFixture(t);
  const pending = begin();
  contents.emit("destroyed");
  assert.equal((await pending).error.name, "AbortError");
  for (const name of ["did-start-navigation", "render-process-gone", "destroyed"]) {
    assert.equal(contents.listenerCount(name), 0);
  }
});
