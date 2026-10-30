# Electron phone-passkey bridge

Linux assertion bridge used by Prospect Mail. It runs an external caBLE helper,
displays a local QR dialog and returns WebAuthn credential JSON to the calling
frame. Registration and conditional/silent requests use Chromium.

## Integration

Create `createPhonePasskeySupport({ electron, helperPath, extraOrigins })` in the
main process. Use an absolute executable helper path. Call
`attach(window.webContents)` before loading remote content and `dispose()` on
shutdown. Disposed instances cannot be reused.

For phone mode, set `contextIsolation: true`, `nodeIntegration: false` and
`nodeIntegrationInSubFrames: true`. Guard the ordinary app preload with
`process.isMainFrame`. The session preload runs in frames but exposes assertion
and cancellation methods only to registered windows and allowed origins. Use
separate sessions for windows with different security preferences.

Setup and runtime requirements are in [Prospect's guide](../../docs/phone-passkeys.md).
The native helper source, dependencies and public suffix data live separately.

## Security boundaries

* Electron supplies the signing origin and cross-origin top-origin metadata.
* Registered WebContents and exact HTTPS origin allowlists gate requests.
* The isolated preload enforces iframe WebAuthn Permissions Policy.
* The helper validates RP IDs against the origin and public suffix list;
  related-origin exceptions are disabled.
* Requests are bounded in size, duration and concurrency. Abort, document
  replacement, window destruction, renderer loss and QR cancellation stop the
  helper. Same-document navigation preserves the request.
* The helper receives JSON over anonymous pipes without a shell. Credential
  data, QR payloads, stderr and configured paths are not logged.
* The QR dialog uses an isolated, sandboxed renderer, a nonpersistent session,
  a restrictive CSP and blocked navigation. It follows the system theme and
  keeps the QR on a white panel.
* Local configuration selects the helper executable. It must be trusted.

## IPC contract

| Channel | Direction | Purpose |
| --- | --- | --- |
| `phone-passkey:config` | renderer → main, synchronous | Document-start feature gate |
| `phone-passkey:get` | renderer → main, invoke | Assertion request; returns credential JSON or a DOM error |
| `phone-passkey:cancel` | renderer → main | Cancel the same frame's request by ID |
| `phone-passkey:prompt-cancel` | local prompt → main | Cancel that prompt's request |
| `phone-passkey:qr` | main → local prompt | QR SVG and signing origin |

The helper reads one `{origin, topOrigin?, publicKey}` JSON object until stdin
EOF. It emits newline-delimited `{type:"qr",svg}`, then one
`{type:"result",credential}` or `{type:"error",name,message}`. `validateOnly` is a
native test diagnostic and is not exposed to remote pages.

## Tests

Run `npm test` in Prospect for the consuming app and bridge unit tests. From the
app directory, run the renderer probe with:

```sh
./node_modules/.bin/electron vendor/electron-phone-passkey/scripts/renderer-smoke.cjs
```

It checks credential prototypes, frame origins and absence of page Node globals
with synthetic assertions in isolated/non-isolated main frames and iframes.
Native protocol tests live with the helper. These probes do not perform a real
phone transaction.

## Licensing

The bridge and helper wrapper are MIT licensed. The native helper statically
links LGPL-2.1-or-later libwebauthn; binary distribution must preserve its pinned
source, build files, notices and relink materials. Public suffix data retains
its MPL-2.0 notice in the helper source.
