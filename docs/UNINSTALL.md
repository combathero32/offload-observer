# Uninstall the manual trial

On the router, from an extracted full source/deployment directory:

    sh install.sh remove

The current full installer removes the latest collector modules, LuCI assets,
ubus ACL and menu entry, and the optional dashboard include when its ownership
marker exists. It stops/disables the service and preserves configuration and the
country database. The collector-only update archive does not contain install.sh.

The earlier trial was installed manually, so it has no APK package to uninstall.
Core OpenWrt ucode modules, ubus, rpcd, iw and LuCI may be used by other components.
Netify is still needed if AppFlow remains in use.

The optional country-lookup library installed during the trial was libmaxminddb.
Preview its removal before removing a package needed elsewhere:

    apk del --simulate libmaxminddb

If the preview is acceptable:

    apk del libmaxminddb

To additionally purge Observer configuration, country database and its own backups,
after uninstalling the service:

    rm -f /etc/config/offload_observer
    rm -rf /usr/share/offload-observer

These paths belong to Observer. Do not remove the shared /usr/share/ucode or LuCI
resource directories. AppFlow, Netify configuration, firewall and offload settings
are not changed by the manual Observer uninstaller.
