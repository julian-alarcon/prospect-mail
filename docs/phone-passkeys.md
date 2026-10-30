# Experimental phone-passkey sign-in on Linux

Phone mode displays a QR code and returns the phone's assertion to Prospect's
session. It requires BlueZ, a powered Bluetooth adapter, a nearby phone with an
existing accepted passkey, and network access for the caBLE tunnel.

## Setup

Download `phone-passkey-helper-0.1.0-source.tar.gz` and `SHA256SUMS` from the
[helper v0.1.0 release](https://github.com/Excellence308/phone-passkey-helper/releases/tag/v0.1.0). The archive includes locked dependency sources.
Install the native build requirements in the [helper README](https://github.com/Excellence308/phone-passkey-helper/blob/v0.1.0/README.md), then
verify and build the archive:

```bash
sha256sum -c SHA256SUMS --ignore-missing
tar -xzf phone-passkey-helper-0.1.0-source.tar.gz
cd phone-passkey-helper-0.1.0
python3 scripts/verify-inputs.py
cargo build --release --locked --offline
```

Keep `public_suffix_list.dat` next to the executable. Open `settings.json` from
the tray menu, add the following with an absolute helper path, then restart:

```json
{
  "phonePasskey": {
    "enabled": true,
    "helperPath": "/absolute/path/to/phone-passkey-helper",
    "extraOrigins": []
  }
}
```

For a federated identity provider, add its exact HTTPS origin to `extraOrigins`.
Wildcards, paths and HTTP origins are rejected. Set `phonePasskey.enabled` to
`false` to restore the default flow.

Passkey enrolment is unsupported. Conditional/silent requests and macOS/Windows
authentication use Chromium. Mail links use the configured external browser.

## Login notifications

Visible login windows stay quiet. A background login-page notification requires
a previously observed mailbox; repeated `AuthNeeded` reports can establish
expiry without inbox DOM. Background expiry gets one recovery reload per
cooldown, then a notification if it persists. Notices are deduplicated.

## Testing

Set `PROSPECT_MAIL_USER_DATA_DIR` to an absolute test-profile path before launch.
Run `npm test` for the unit suite and the actual-startup probe with:

```sh
./node_modules/.bin/electron scripts/phone-profile-smoke.cjs
```

The probe uses synthetic credentials and a temporary profile. See the
[Electron bridge](../vendor/electron-phone-passkey/README.md) for its security
boundaries, protocol and renderer tests. Native tests belong to the helper.
