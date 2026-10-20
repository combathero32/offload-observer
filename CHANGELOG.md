# Changelog

## 0.2.4

Optional station-mode Wi-Fi uplink accounting for the main chart; unavailable
readings do not fall back to conntrack. Separate raw connection totals and
explicitly unverified application/country/device breakdowns. Reconnection,
counter reset and missing-data baselines.

## 0.2.3

Baseline every newly visible/reappearing flow instead of importing lifetime
counters. Add largest-baseline and largest-counted-increment diagnostics.
Inflated accounting remained unresolved on the router.

## 0.2.2

Bounded Netify socket polling, bounded address caches, prepared scan directions,
self-rearmed timers and processing-time diagnostics. CPU load subsequently fell.

## 0.2.1

Decimal bits/second rate display; cumulative totals remain in binary byte units.

## 0.2.0

Throughput chart, application filtering, country donut and client usage layout.

## 0.1.1

Terminate exported ucode function declarations with semicolons for the router's
parser; validate the actual imported module without stripping exports.

## 0.1.0

Initial read-only conntrack and Netify observer prototype.
