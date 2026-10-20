# Collector 0.2.3

This documents the earlier accounting fix. For the current optional Wi-Fi uplink
source and 0.2.4 update, follow [WIFI-UPLINK-UPDATE.md](WIFI-UPLINK-UPDATE.md).

Fixes a confirmed accounting defect: a connection absent from the preceding
snapshot was counted using its entire lifetime counters. A late first sighting
or reappearance could therefore import historical gigabytes into a single
five-second interval. The raw summary supplied by the user confirms inflated
totals originate in the collector; the current evidence does not prove this
defect is the sole cause of the reported spikes.

Every newly visible connection now establishes a baseline. Only increases
between consecutive sightings are counted. An absent connection returning to
the table establishes a fresh baseline. This avoids historical imports but
misses bytes before first sighting and across observation gaps. Very short
connections may contribute no bytes. All totals remain sampled estimates.

The existing 0.2.2 CPU mitigations are retained: bounded socket polling, cached
address parsing, and scan timers rearmed after each scan completes.

No ceiling is applied to reported rates. The collector includes traffic to
upstream private networks as well as Internet addresses. It relies on the
kernel's counters: delayed or incorrect hardware counter updates can still
affect measured rates. The added diagnostics help distinguish those cases.

## Update

Copy offload-observer-collector-0.2.3.tar.gz to /tmp, then run on the router:

    cd /tmp
    tar -xzf offload-observer-collector-0.2.3.tar.gz
    cd offload-observer-collector
    sh update-collector.sh

The installer backs up both collector files, stops Observer, updates and
compiles it using the router's ucode, starts it and queries ubus after two
seconds. A failure restores the prior files and leaves Observer stopped.
RAM totals reset. Config, country database and visuals are preserved.
Reload LuCI to clear browser history from the old collector.

After a minute:

    ubus call offload_observer summary

Check collector_version is 0.2.3. Summary rates are bytes/second; LuCI converts
them to bits/second once. For reference, 6,250,000 bytes/second is 50 Mbps.

New health fields:

- flows_baselined: cumulative baseline observations, including startup and
  reappearances; not a count of unique connections.
- last_flows_baselined: baselines established in the latest scan.
- missing_flows: previously tracked connections absent in the latest scan.
- sample_delta and sample_elapsed_seconds: the numerator in bytes and
  denominator in seconds used to calculate the latest rates.
- largest_baseline: largest lifetime counter observed at a baseline since
  collector start, including client, remote IP and scan number. These lifetime
  bytes are not added to usage.
- largest_counted_delta: largest summed upload/download increment of one
  connection since start, with client, remote IP, previous/current counters,
  elapsed seconds, hardware offload flag and scan number.

If rates still spike, paste the summary. The largest_counted_delta record will
help identify the connection and whether its raw counter jumped. For a more
detailed read-only capture spanning approximately 18 seconds, run:

    sh capture.sh

The script saves four summaries, conntrack tables and interface counters under
/tmp and prints an archive path. Connection IPs are included. Nothing is sent
automatically.

Rollback:

    sh update-collector.sh rollback

Restores the backed-up collector and leaves it stopped. Prior inflated totals
cannot be repaired reliably; the restart starts new totals.

## Validation

51 core checks and 22 daemon adapter checks run on a real ucode WebAssembly VM.
The regression with a newly visible 12 GB connection fails on 0.2.2 and passes
on 0.2.3. Tests also cover reappearance without recounting, subsequent increments,
NAT, IPv6, counter resets, accounting conservation and socket polling bounds.
Native OpenWrt timers and sockets are mocked; router measurement remains required.
