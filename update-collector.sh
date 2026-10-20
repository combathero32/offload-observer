#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
storage=/usr/share/offload-observer
daemon=/usr/sbin/offload-observer
core=/usr/share/ucode/offload-observer/core.uc
service=/etc/init.d/offload-observer
mode=update
if [ "$#" -gt 0 ]; then mode=$1; fi
manifest() {
    cat <<'FILES'
usr/sbin/offload-observer
usr/share/ucode/offload-observer/core.uc
usr/share/ucode/offload-observer/uplink.uc
www/luci-static/resources/offload_observer/ui.js
FILES
}
restore_files() {
    manifest | while IFS= read -r relative; do
        if [ -f "$backup/root/$relative" ]; then cp "$backup/root/$relative" "/$relative"
        elif [ -f "$backup/missing/$relative" ]; then rm -f "/$relative"
        else echo "Incomplete backup: $relative"; exit 1; fi
    done
}
[ "$(id -u)" = 0 ] || { echo "Run on the router as root."; exit 1; }
[ -f "$daemon" ] && [ -f "$core" ] && [ -f "$service" ] || { echo "Install Observer first."; exit 1; }
command -v ucode >/dev/null
if [ "$mode" = rollback ]; then
    backup=$(cat "$storage/last-collector-backup")
    case "$backup" in /usr/share/offload-observer/collector-backup.*) ;; *) echo "Invalid backup path."; exit 1 ;; esac
    [ -d "$backup/root" ] || { echo "Backup predates this updater; use the earlier updater to restore it."; exit 1; }
    "$service" stop 2>/dev/null
    restore_files
    echo "Previous collector and UI restored and left stopped. Configuration was preserved."
    exit 0
fi
[ "$mode" = update ] || { echo "Usage: sh update-collector.sh [update|rollback]"; exit 1; }
manifest | while IFS= read -r relative; do
    [ -f "$base/root/$relative" ] || { echo "Missing update file: $relative"; exit 1; }
done
mkdir -p "$storage"
backup=$(mktemp -d "$storage/collector-backup.XXXXXX")
manifest | while IFS= read -r relative; do
    mkdir -p "$(dirname "$backup/root/$relative")" "$(dirname "$backup/missing/$relative")"
    if [ -f "/$relative" ]; then cp "/$relative" "$backup/root/$relative"
    else : >"$backup/missing/$relative"; fi
done
printf '%s\n' "$backup" >"$storage/last-collector-backup"
compiled=$(mktemp /tmp/offload-observer-check.XXXXXX)
restore_on_error() {
    code=$?
    trap - EXIT HUP INT TERM
    rm -f "$compiled"
    if [ "$code" -ne 0 ]; then
        "$service" stop 2>/dev/null || true
        restore_files
        echo "Update failed; previous collector and UI restored and left stopped."
    fi
    exit "$code"
}
trap restore_on_error EXIT
trap 'exit 1' HUP INT TERM
"$service" stop 2>/dev/null
manifest | while IFS= read -r relative; do
    mkdir -p "$(dirname "/$relative")"
    cp "$base/root/$relative" "/$relative"
    chmod 644 "/$relative"
done
chmod 755 "$daemon"
ucode -c -o "$compiled" "$daemon"
"$service" start
sleep 2
ubus call offload_observer status
echo "Collector and source-aware UI 0.2.4 installed. RAM totals restarted."
echo "Configuration, CSS, dashboard adapter and country database preserved. Refresh LuCI with Ctrl+F5."
echo "Backup: $backup"
