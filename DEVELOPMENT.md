# Development

Read docs/STATUS.md before changing accounting. This experiment has known accuracy
limits. Its user later requested uninstall instructions; confirm actual router
state before deploying. The latest source is prototype 0.2.4.

## Core checks

Node.js 20 or newer:

    npm test

The runner downloads the official try.ucode-lang.org WebAssembly interpreter into
ignored .cache/ucode and verifies the SHA-256 pins in tests/ucode-runtime.json.
No npm dependency is needed for these 94 checks. The hosted URLs are mutable:
if the runtime changes, review the replacement and update the pins deliberately.
Do not bypass a checksum mismatch. Network access is needed for the first download.

Alternatively supply an existing interpreter to the individual runners:

    node tests/run-core.cjs /path/to/ucode.js /path/to/ucode.wasm
    node tests/run-uplink.cjs /path/to/ucode.js /path/to/ucode.wasm
    node tests/daemon-smoke.cjs /path/to/ucode.js /path/to/ucode.wasm

These exercise the real ucode modules; native ubus/socket/uloop/iw adapters are
mocked. Preserve semicolons after exported function declarations: the router's
parser rejected an earlier version without them.

## Browser checks

    npm install
    npx playwright install chromium
    npm run test:ui

For an existing browser installation:

    node tests/frontend.cjs /path/to/playwright /path/to/browser

HTML and screenshots are written under ignored test-output/. Fixtures are sample
data, not captures. Tests cover mobile layout, units, filters, source labels,
missing samples, safe rendering, history resets and polling focus.

## Build deployment archives

With Python 3, from the repository root:

    python scripts/build.py

This packages source into build/, with SHA-256 sidecars and Linux file permissions.
It excludes Git metadata, build output, runtime cache, databases, logs and browser
screenshots. Review the source tree before building: other non-ignored files can
be included. It does not build an APK. Use an OpenWrt SDK matching the target
release for the Makefile package target.

Manual deployment is documented in README.md and WIFI-UPLINK-UPDATE.md. A fresh
source copy contains the full installer; existing installations use the collector
archive. The updater backs up files and restores them on compilation/startup
failure. Updates reset RAM totals. Nothing in the test/build scripts deploys code.

## Measurement boundaries

Keep hardware acceleration enabled when evaluating the intended design. Record
the source, timestamps, connection identity and transfer stage. Ordinary interface
statistics can miss accelerated Wi-Fi traffic. Station, conntrack and client
payload counters have different scopes; compare synchronized intervals.

Do not present unverified breakdowns as accurate or clamp rates to an ISP plan.
Fix the source or visibly mark uncertainty. Application recognition is separate
from byte measurement.

Do not commit actual captures, databases or credentials. Review staged changes
before uploading, even though this repository is intended to be private.
