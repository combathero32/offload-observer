# Continuation notes

Last reviewed: 2026-10-20. Current prototype: 0.2.4.

## What exists

A manually installed OpenWrt companion consisting of a ucode collector, ubus API,
LuCI page and optional dashboard adapter. It preserves hardware flow offloading.
The latest UI displays rates in decimal bits/second and cumulative bytes in
binary units. No APK has been built or published.

The original investigation named an AX3000T. Later router diagnostics identify a
Cudy TR3000 v1 (OpenWrt U-Boot layout), MT7981/Filogic, OpenWrt 25.12.6,
kernel 6.12.112, Netify Agent 4.4.7. Do not assume both models were validated.

## Results and limits

- The initial collector reached about 98% of one core. Version 0.2.2 replaced the
  Netify fd readiness watcher with bounded polling, cached address parsing and
  rearmed scan timers after completion. Later router graphs showed a sustained
  reduction around 22:16, mostly below 10% with intermittent peaks. These are
  whole-router graphs and do not isolate one optimization or prove which version
  was running at every point. No exact cause for the original spin was established.
- Version 0.2.3 fixed a reproducible lifetime-counter import: every first sighting
  or reappearance now baselines a connection. This deliberately undercounts traffic
  before first sighting, across missed observations and after the final sighting.
- That fix did not resolve all inflated usage. Diagnostics recorded a connection
  whose apparent upload increased by 442.9 MB in 5.58 seconds. The displayed rate
  correctly reflected the supplied counter values; their accuracy remains disputed.
- Wi-Fi uplink interface counters in /proc/net/dev missed substantial offloaded
  traffic. Station counters from iw provided another measurement. Three supplied
  readings corresponded to about 58.7 Mbps upload and 1.47 Mbps download; station
  timing did not align exactly with conntrack snapshots. These observations do not
  establish a particular kernel/driver bug or prove subscriber line-rate accuracy.
- Version 0.2.4 offers optional Wi-Fi station accounting for the main chart.
  Application, country and device usage remain conntrack-based and visibly
  unverified. Link totals include router traffic and all users of the uplink.
  Never silently reconcile them, scale the breakdowns, or clamp to an ISP plan.
- The user accepted that source separation. The latest build passed local tests;
  deployment of 0.2.4 and its real router performance were not confirmed.
- Application coverage in the supplied samples was very low. Hardware acceleration
  can leave Netify without enough visible packets to classify a flow. Changing the
  byte source does not repair missing application labels.
- The user subsequently requested uninstall instructions. Removal was described;
  completion was not confirmed. Do not assume the service is currently installed.

## Tests already run

- 51 core accounting checks, 15 station parser/sampler checks and 28 daemon adapter
  checks on the official ucode WebAssembly interpreter.
- Browser checks: chart units, filters, polling focus, history resets, source
  changes, missing-data states, unverified labels, safe rendering and mobile layout.
- Staged update/rollback checks, including missing/existing uplink module,
  compilation/startup failure and preservation of config, CSS, dashboard and MMDB.
- Native OpenWrt socket/timer/iw/ubus integration was mocked. Passing local tests
  is not proof of deployment accuracy.

## Next useful work

1. Confirm the installed version and measurement source before comparing results.
2. Collect synchronized station, conntrack and client transfer counters during
   download and upload, including an idle period afterward. Reconcile timestamps.
3. Determine whether suspicious conntrack increments originate in driver accounting,
   tuple reuse, delayed hardware synchronization, or another collector defect.
   Use connection IDs/netlink events if tuple ambiguity is implicated.
4. Obtain accurate per-client attribution before treating device usage as verified.
5. Investigate label visibility independently of accounting; keep Unknown explicit.
6. Measure collector CPU time directly, rather than inferring it only from wall time.
7. Improve source selection/configuration and dependency checks, then test in a
   matching OpenWrt SDK and build an APK if the prototype becomes reliable.

## Code map

- root/usr/sbin/offload-observer: configuration, scanning, Netify consumer, ubus.
- root/usr/share/ucode/offload-observer/core.uc: parsing, direction, accounting,
  Netify tuple labels, bounded caches.
- root/usr/share/ucode/offload-observer/uplink.uc: station parser and baselines.
- root/www/luci-static/resources/offload_observer/: shared UI and CSS.
- dashboard/: optional modern dashboard widget adapter.
- install.sh, update-collector.sh and update-visuals.sh: manual deployment.
- capture.sh: read-only diagnostic capture to router /tmp; output contains IPs.

The private example subnet in the default config is illustrative and must be
changed for another network. Do not commit actual captures, MMDB databases, tokens
or router backups. The repository intentionally contains no captured router logs.
