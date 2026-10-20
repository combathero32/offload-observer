# Wi-Fi uplink measurement — 0.2.4

The main chart can now use Wi-Fi station counters from the selected uplink.
The supplied phy0-sta0 snapshots show why ordinary /proc/net/dev counters are
not a useful comparison on this hardware-offloaded Wi-Fi path. Station counters
provide another measurement independent of Observer's per-connection arithmetic.
This change does not identify or fix the underlying conntrack discrepancy.

The source measures the entire Wi-Fi link: all clients, router-originated traffic,
and anything else using that link. It is not a measure of Internet payload alone.
Station counters are reported by the driver and are not independently certified
as billing-accurate. Their timing, scope and layer differ from connection counters.

Application, country and device breakdowns still use conntrack. They are explicitly
marked **Unverified usage estimates**, with a warning that their totals may disagree
with the main chart. The application coverage percentage refers to those breakdown
bytes, not to the entire Wi-Fi link. No proportional scaling or rate ceiling is used.
The source does not repair missing Netify detections or low application coverage.

## Update your existing installation

Copy offload-observer-collector-0.2.4.tar.gz to /tmp. On the router:

    cd /tmp
    tar -xzf offload-observer-collector-0.2.4.tar.gz
    cd offload-observer-collector
    uci set offload_observer.main.uplink_wifi='phy0-sta0'
    uci commit offload_observer
    sh update-collector.sh

The interface must be a station-mode uplink with one connected peer. The router
must have a working iw command, as demonstrated in the supplied samples.
If iw cannot return valid counters, rates remain Unavailable with an error.

The updater backs up and replaces the collector, core module, new uplink module,
and shared UI. It compiles on the router before starting and queries ubus after
two seconds. The first station reading establishes a baseline, so rates initially
show Unavailable. They appear after the second successful scan, normally about
five seconds later. Refresh LuCI with Ctrl+F5.

Restarting discards existing RAM totals. The updater preserves the configuration,
country database, CSS and dashboard adapter. The two UCI commands above change
only the selected source option. No offload, firewall, network or Netify settings
are changed. Hardware acceleration remains enabled.

After about a minute:

    ubus call offload_observer summary

Expected:

- version and health.collector_version are 0.2.4.
- measurement.source is wifi_station and measurement.interface is phy0-sta0.
- measurement.valid becomes true after two valid station readings.
- total and rates come from Wi-Fi station counter increments.
- raw_conntrack retains the separate connection totals/rates for diagnosis.
- breakdowns_verified is false. Tables are not claimed to reconcile with total.
- health.uplink_delta, uplink_elapsed_seconds and uplink_ms expose link sampling.

Missing data, command failures, multiple peers, roaming to another peer, counter
decreases, or a decrease in connected time invalidate a sample. Failures do not
substitute conntrack rates or fabricate zero traffic. After a gap or reset, a fresh
baseline is required; totals retain prior observed increments but omit gap bytes.

Your three supplied station readings span about 12.032 seconds and increase by
88,343,047 transmit bytes and 2,216,746 receive bytes: roughly 58.7 Mbps upload and
1.47 Mbps download. The chart is not capped to the advertised 50 Mbps service.
These snapshots are not synchronized exactly with the older conntrack samples,
so they are not a precise interval-by-interval validation of those counters.

## Rollback

From this extracted directory:

    sh update-collector.sh rollback

Restores the previous collector, modules and UI, removing a newly added uplink
module when it was absent before. Leaves Observer stopped. Configuration remains
as configured; to remove the optional source setting:

    uci -q delete offload_observer.main.uplink_wifi
    uci commit offload_observer

Run the service start command only if you want the restored version running.
An updater failure also restores the prior files and leaves the service stopped.

## Validation

- 51 core accounting checks, 15 station parser/sampler checks replaying the supplied
  counters, and 28 daemon adapter checks on a real ucode WebAssembly VM.
- Station tests cover baseline, direction, deltas, idle traffic, read failure,
  recovery, counter reset, peer change, reconnection and ambiguous/missing fields.
- Daemon tests confirm source selection, separate raw totals, first-reading
  Unavailable state, command failure without fallback and recovery baseline.
- Browser tests cover warning labels, all three unverified sections, source-change
  history reset, missing readings, existing filters and responsive layout.
- Staged update/rollback checks cover new/existing modules and compilation/startup
  failures, preserving configuration, CSS, dashboard adapter and MMDB.

Native iw/uloop/ubus behavior and post-install router CPU remain to be validated.
