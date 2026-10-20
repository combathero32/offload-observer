#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mode=update
if [ "$#" -gt 0 ]; then mode=$1; fi
assets=/www/luci-static/resources/offload_observer
view=/www/luci-static/resources/view/offload_observer/index.js
dashboard=/www/luci-static/resources/view/dashboard/include/90_offload_observer.js
storage=/usr/share/offload-observer

[ "$(id -u)" = 0 ] || { echo "Run on the router as root."; exit 1; }
if [ "$mode" = rollback ]; then
    [ -f "$storage/last-ui-backup" ] || { echo "No visual backup recorded."; exit 1; }
    backup=$(cat "$storage/last-ui-backup")
    case "$backup" in /usr/share/offload-observer/ui-backup.*) ;; *) echo "Invalid backup path."; exit 1 ;; esac
    [ -f "$backup/ui.js" ] && [ -f "$backup/index.js" ] || { echo "Incomplete backup."; exit 1; }
    cp "$backup/ui.js" "$assets/ui.js"
    cp "$backup/index.js" "$view"
    if [ -f "$backup/observer.css" ]; then cp "$backup/observer.css" "$assets/observer.css"
    else rm -f "$assets/observer.css"; fi
    if [ -f "$backup/dashboard.js" ]; then cp "$backup/dashboard.js" "$dashboard"; fi
    echo "Previous visuals restored. Press Ctrl+F5 in LuCI."
    exit 0
fi
[ "$mode" = update ] || { echo "Usage: sh update-visuals.sh [update|rollback]"; exit 1; }
[ -f "$assets/ui.js" ] && [ -f "$view" ] || { echo "Install Offload Observer before this visual update."; exit 1; }
for relative in offload_observer/ui.js offload_observer/observer.css view/offload_observer/index.js; do
    [ -f "$base/root/www/luci-static/resources/$relative" ] || { echo "Missing update asset: $relative"; exit 1; }
done
[ -f "$base/dashboard/90_offload_observer.js" ] || { echo "Missing dashboard adapter."; exit 1; }
mkdir -p "$storage"
backup=$(mktemp -d "$storage/ui-backup.XXXXXX")
cp "$assets/ui.js" "$backup/ui.js"
cp "$view" "$backup/index.js"
if [ -f "$assets/observer.css" ]; then cp "$assets/observer.css" "$backup/observer.css"; fi
if [ -f "$dashboard" ]; then cp "$dashboard" "$backup/dashboard.js"; fi
printf '%s\n' "$backup" >"$storage/last-ui-backup"
# Each file is staged beside its destination, then replaced with a rename.
for relative in offload_observer/observer.css offload_observer/ui.js view/offload_observer/index.js; do
    target=/www/luci-static/resources/$relative
    cp "$base/root/www/luci-static/resources/$relative" "$target.new"
    chmod 644 "$target.new"
    mv "$target.new" "$target"
done
if [ -f "$dashboard" ]; then
    cp "$base/dashboard/90_offload_observer.js" "$dashboard.new"
    chmod 644 "$dashboard.new"
    mv "$dashboard.new" "$dashboard"
fi
echo "Visuals updated. Collector and country database were not restarted or changed."
echo "Press Ctrl+F5 in LuCI. Browser chart history starts when the page opens."
echo "Backup: $backup"
