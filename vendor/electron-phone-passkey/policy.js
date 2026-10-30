const MAX_BYTES = 1024 * 1024;
const DEFAULT_ORIGINS = [
  "https://login.microsoftonline.com",
  "https://login.microsoft.com",
  "https://login.live.com",
];

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (typeof value !== "string" || url.protocol !== "https:" ||
        url.username || url.password || url.pathname !== "/" || url.search ||
        url.hash || url.hostname.includes("*")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(extras = []) {
  return new Set([...DEFAULT_ORIGINS, ...(Array.isArray(extras) ? extras : [])]
    .map(normalizeOrigin).filter(Boolean));
}

function frameContext(frame, origins) {
  // Origins always come from Electron, never the renderer's request body.
  if (!frame || frame.detached) throw new Error("Untrusted sign-in frame.");
  const origin = new URL(frame.url).origin;
  if (!origins.has(origin)) throw new Error("Sign-in origin is not allowed.");
  let ancestor = frame.parent;
  let crossOrigin = false;
  while (ancestor) {
    const parentOrigin = new URL(ancestor.url).origin;
    if (!parentOrigin.startsWith("https://")) throw new Error("Insecure parent frame.");
    crossOrigin ||= parentOrigin !== origin;
    ancestor = ancestor.parent;
  }
  const topOrigin = crossOrigin ? new URL(frame.top.url).origin : undefined;
  return { origin, topOrigin };
}

function validateRequest(request) {
  if (!request || typeof request.id !== "string" || request.id.length > 128 ||
      !request.id.length || !request.publicKey ||
      typeof request.publicKey.challenge !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(request.publicKey.challenge) ||
      request.publicKey.challenge.length > 65536) {
    throw new Error("Invalid passkey request.");
  }
  if (Buffer.byteLength(JSON.stringify(request)) > MAX_BYTES) {
    throw new Error("Passkey request is too large.");
  }
  const timeout = request.publicKey.timeout ?? 120000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("Invalid timeout.");
  return Math.min(timeout, 120000);
}

module.exports = { MAX_BYTES, DEFAULT_ORIGINS, normalizeOrigin, allowedOrigins, frameContext, validateRequest };
