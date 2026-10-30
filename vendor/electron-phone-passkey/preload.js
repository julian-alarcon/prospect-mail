const { ipcRenderer, contextBridge } = require("electron");

// Gate the document-start bridge using the registered window and frame origin.
const config = ipcRenderer.sendSync("phone-passkey:config");

function installPhonePasskey() {
  const bridge = window.phonePasskey;
  if (!bridge || !navigator.credentials || window.__phonePasskeyInstalled) return;
  window.__phonePasskeyInstalled = true;
  const originalGet = navigator.credentials.get.bind(navigator.credentials);
  const encode = (value) => {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) :
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/={1,2}$/, "");
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
    }
    return value;
  };
  const decode = (value) => {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
  };
  const construct = (prototype, fields) => Object.create(prototype, Object.getOwnPropertyDescriptors(fields));

  navigator.credentials.get = async (options) => {
    // Autofill/background probes never show a QR window.
    if (!options?.publicKey || options.mediation === "conditional" || options.mediation === "silent") {
      return originalGet(options);
    }
    if (options.signal?.aborted) throw new DOMException("Authentication was cancelled.", "AbortError");
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (window !== window.top && (!policy || !policy.allowsFeature("publickey-credentials-get"))) {
      throw new DOMException("Passkeys are not allowed in this frame.", "NotAllowedError");
    }
    const id = crypto.randomUUID();
    const abort = () => bridge.cancel(id);
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      const result = await bridge.get({ id, publicKey: encode(options.publicKey) });
      if (options.signal?.aborted) throw new DOMException("Authentication was cancelled.", "AbortError");
      if (!result.ok) throw new DOMException(result.error.message, result.error.name);
      const data = result.credential;
      const json = () => JSON.parse(JSON.stringify(data));
      const extensions = () => {
        const outputs = json().clientExtensionResults || {};
        if (outputs.prf?.results) {
          for (const field of ["first", "second"]) {
            if (outputs.prf.results[field]) outputs.prf.results[field] = decode(outputs.prf.results[field]);
          }
        }
        if (typeof outputs.largeBlob?.blob === "string") outputs.largeBlob.blob = decode(outputs.largeBlob.blob);
        return outputs;
      };
      const response = construct(AuthenticatorAssertionResponse.prototype, {
        clientDataJSON: decode(data.response.clientDataJSON),
        authenticatorData: decode(data.response.authenticatorData),
        signature: decode(data.response.signature),
        userHandle: data.response.userHandle ? decode(data.response.userHandle) : null,
      });
      return construct(PublicKeyCredential.prototype, {
        id: data.id, rawId: decode(data.rawId), type: "public-key",
        authenticatorAttachment: "cross-platform", response,
        getClientExtensionResults: extensions, toJSON: json,
      });
    } finally {
      options.signal?.removeEventListener("abort", abort);
    }
  };
}

if (config?.enabled) {
  const api = Object.freeze({
    get: (request) => {
      const policy = document.permissionsPolicy || document.featurePolicy;
      if (window !== window.top && (!policy || !policy.allowsFeature("publickey-credentials-get"))) {
        return Promise.resolve({ ok: false, error: { name: "NotAllowedError", message: "Passkeys are not allowed in this frame." } });
      }
      return ipcRenderer.invoke("phone-passkey:get", request);
    },
    cancel: (id) => ipcRenderer.send("phone-passkey:cancel", id),
  });
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld("phonePasskey", api);
    contextBridge.executeInMainWorld({ func: installPhonePasskey });
  } else {
    // Support non-isolated consumers too; Prospect uses context isolation.
    Object.defineProperty(window, "phonePasskey", { value: api });
    installPhonePasskey();
  }
}

module.exports = { installPhonePasskey };
