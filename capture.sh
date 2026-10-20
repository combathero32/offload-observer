#!/bin/sh
# Read-only capture for investigating counter jumps. Saved only to /tmp.
set -eu
umask 077
capture=$(mktemp -d /tmp/offload-observer-capture.XXXXXX)
for sample in 0 1 2 3; do
    date +%s >"$capture/$sample.time"
    cat /proc/uptime >"$capture/$sample.uptime"
    ubus call offload_observer summary >"$capture/$sample.summary.json"
    cat /proc/net/nf_conntrack >"$capture/$sample.conntrack"
    ip -s link >"$capture/$sample.interfaces"
    if [ "$sample" != 3 ]; then sleep 6; fi
done
tar -czf "$capture.tar.gz" -C /tmp "$(basename "$capture")"
echo "Read-only capture saved to: $capture.tar.gz"
echo "Contains connection IP addresses and interface names; inspect before sharing."
