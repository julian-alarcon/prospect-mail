const test = require("node:test");
const assert = require("node:assert/strict");
const { allowedOrigins, frameContext, validateRequest } = require("../policy");

test("allowlists use exact HTTPS origins and reject paths, credentials and wildcards", () => {
  const origins = allowedOrigins(["https://sso.example.org", "http://sso.example.org", "https://*.example.org", "https://sso.example.org/path", "https://user:password@example.org"]);
  assert.equal(origins.has("https://sso.example.org"), true);
  assert.equal(origins.has("https://evil.sso.example.org"), false);
  assert.equal(origins.size, 4);
});

test("frame origins and cross-origin context come from the browser frame tree", () => {
  const top = { url: "https://login.microsoftonline.com/?token=secret", parent: null };
  top.top = top;
  const frame = { url: "https://login.microsoft.com/fido", parent: top, top };
  assert.deepEqual(frameContext(frame, allowedOrigins()), {
    origin: "https://login.microsoft.com", topOrigin: "https://login.microsoftonline.com",
  });
  assert.throws(() => frameContext({ ...frame, url: "https://evil.example" }, allowedOrigins()));
  assert.throws(() => frameContext({ ...frame, detached: true }, allowedOrigins()));
  assert.deepEqual(frameContext(top, allowedOrigins()), { origin: "https://login.microsoftonline.com", topOrigin: undefined });
});

test("requests have bounded sizes, identifiers and finite timeouts", () => {
  const request = { id: "request", publicKey: { challenge: "AQID", timeout: 500000 } };
  assert.equal(validateRequest(request), 120000);
  assert.throws(() => validateRequest({ ...request, id: "x".repeat(129) }));
  assert.throws(() => validateRequest({ ...request, publicKey: { challenge: "AQID", timeout: -1 } }));
  assert.throws(() => validateRequest({ ...request, publicKey: { challenge: "AQID", timeout: Infinity } }));
  assert.throws(() => validateRequest({ ...request, publicKey: { challenge: "not!base64" } }));
  assert.throws(() => validateRequest({ ...request, extra: "x".repeat(1024 * 1024) }));
});
