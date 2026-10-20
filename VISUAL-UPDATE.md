# Visual update 0.2.1

For the existing running Offload Observer, use the small visual-update archive.
It replaces only the browser assets and an already installed dashboard adapter.
No collector restart is needed. Current counters, country database, configuration,
and hardware-offload settings are preserved.

## Install

Copy offload-observer-visuals-0.2.1.tar.gz to the router's /tmp directory.
Run:

    cd /tmp
    tar -xzf offload-observer-visuals-0.2.1.tar.gz
    cd offload-observer-visuals
    sh update-visuals.sh

Then open Status → Offload Observer and press **Ctrl+F5**.
If the optional dashboard tab was already installed, it is updated too.
The updater does not install a dashboard tab that was absent.

## What changes

- Dark bordered panels and compact status badges.
- Blue download and green upload metrics and a live SVG throughput chart.
- Rates use bits per second with decimal bps/Kbps/Mbps/Gbps/Tbps units.
  Traffic totals remain bytes (KiB/MiB/GiB). Conversion occurs only in the UI.
- Searchable application table with traffic bars, friendly names and a Show all toggle.
- Country ring chart with percentage legend. Unknown and private traffic stay visible.
- Searchable client table with rates, traffic bars and upload/download totals.
- Responsive layout and collapsible measurement notes.

The ring uses the countries already reported by the collector. Application
categories are not invented. Client rows are still per IP; no MAC addresses or
per-client application drill-down are added by this visual update.

The throughput chart stores five minutes of received samples in the browser.
It begins filling when the page opens and resets on page reload. Search filters
and focus are preserved across polling updates. Gaps in received samples are
drawn as gaps.

## Roll back

The updater records the previous assets in a dedicated directory under
/usr/share/offload-observer. To restore them:

    cd /tmp/offload-observer-visuals
    sh update-visuals.sh rollback

Press Ctrl+F5 again. There is no service restart.

## Validation

The shipped UI was rendered in a local headless Edge browser. Checks cover the
SVG charts, search and exclusion filters, filter/focus preservation while polling,
safe display of untrusted labels, history reset on collector restart, and desktop
and mobile layout. Preview files use clearly marked sample data.

The existing accounting core and daemon adapter tests were rerun unchanged.
The deployment script received shell syntax checks. This browser update has not
yet been tested within your particular LuCI theme on the router.
