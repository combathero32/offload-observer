#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mode=install
if [ "$#" -gt 0 ]; then mode=$1; fi
marker=/usr/share/offload-observer/manual-install

manifest() {
    cat <<'FILES'
etc/init.d/offload-observer
usr/sbin/offload-observer
usr/share/ucode/offload-observer/core.uc
usr/share/ucode/offload-observer/uplink.uc
usr/share/rpcd/acl.d/luci-app-offload-observer.json
usr/share/luci/menu.d/luci-app-offload-observer.json
www/luci-static/resources/offload_observer/ui.js
www/luci-static/resources/offload_observer/observer.css
www/luci-static/resources/view/offload_observer/index.js
FILES
}

if [ "$(id -u)" != 0 ]; then echo "Run this on your OpenWrt router as root."; exit 1; fi
case "$mode" in
    remove)
        [ -f "$marker" ] || { echo "No manual installation marker; refusing to remove files."; exit 1; }
        /etc/init.d/offload-observer stop || true
        /etc/init.d/offload-observer disable || true
        manifest | while IFS= read -r relative; do rm -f "/$relative"; done
        if [ -f /usr/share/offload-observer/manual-dashboard ]; then
            rm -f /www/luci-static/resources/view/dashboard/include/90_offload_observer.js
            rm -f /usr/share/offload-observer/manual-dashboard
        fi
        rm -f "$marker"
        /etc/init.d/rpcd reload
        echo "Removed. Configuration and any country database were preserved."
        exit 0
        ;;
    dashboard)
        [ -f "$marker" ] || { echo "Install the companion first."; exit 1; }
        widgets=/www/luci-static/resources/view/dashboard/lib/widgets.js
        if [ ! -f "$widgets" ] || ! grep -q "'cards', 'charts', 'tabs'" "$widgets"; then
            echo "This dashboard version has no verified named-widget API."
            echo "Use Status > Offload Observer. No dashboard files were changed."
            exit 1
        fi
        target=/www/luci-static/resources/view/dashboard/include/90_offload_observer.js
        [ ! -e "$target" ] || { echo "Dashboard include already exists; refusing to overwrite."; exit 1; }
        cp "$base/dashboard/90_offload_observer.js" "$target"
        chmod 644 "$target"
        printf '%s\n' 'owned dashboard include' >/usr/share/offload-observer/manual-dashboard
        echo "Dashboard tab installed. Refresh LuCI and enable Traffic usage in its layout settings."
        exit 0
        ;;
    install) ;;
    *) echo "Usage: sh install.sh [install|dashboard|remove]"; exit 1 ;;
esac

[ ! -e "$marker" ] || { echo "Already installed. Remove the manual installation before reinstalling."; exit 1; }
command -v ucode >/dev/null || { echo "Install ucode and its fs, uci, ubus, uloop and socket modules first."; exit 1; }
ucode -e 'require("fs"); require("uci"); require("ubus"); require("uloop"); require("socket");' >/dev/null
manifest | while IFS= read -r relative; do
    [ -f "$base/root/$relative" ] || { echo "Bundle file missing: $relative"; exit 1; }
    [ ! -e "/$relative" ] || { echo "Existing file: /$relative. Refusing to overwrite."; exit 1; }
done
# Preflight completes before any router files are installed.
manifest | while IFS= read -r relative; do
    mkdir -p "$(dirname "/$relative")"
    cp "$base/root/$relative" "/$relative"
    chmod 644 "/$relative"
done
chmod 755 /usr/sbin/offload-observer /etc/init.d/offload-observer
if [ ! -e /etc/config/offload_observer ]; then
    cp "$base/root/etc/config/offload_observer" /etc/config/offload_observer
    chmod 600 /etc/config/offload_observer
fi
mkdir -p /usr/share/offload-observer
printf '%s\n' '0.2.4 manual installation' >"$marker"
compiled=$(mktemp /tmp/offload-observer-check.XXXXXX)
if ! ucode -c -o "$compiled" /usr/sbin/offload-observer; then
    rm -f "$compiled"
    echo "Router-side compilation failed. Service was not started."
    echo "Run sh install.sh remove to remove the installed trial."
    exit 1
fi
rm -f "$compiled"
/etc/init.d/rpcd reload
echo "Installed without starting. Check /etc/config/offload_observer, then run:"
echo "/etc/init.d/offload-observer start"
echo "Status > Offload Observer shows the result. Enable at boot only after validation."
