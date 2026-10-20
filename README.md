# Offload Observer — trial companion for OpenWrt

**Experimental; not billing-quality accounting.** See
[continuation notes](docs/STATUS.md) for measured results, unresolved issues and
where to resume development. Version history is in [CHANGELOG.md](CHANGELOG.md).

**Update 0.2.4:** existing installations should follow
[WIFI-UPLINK-UPDATE.md](WIFI-UPLINK-UPDATE.md) to use a Wi-Fi uplink for the main
chart. Breakdown usage is explicitly marked unverified. Rates remain in bits.

Uses conntrack for breakdowns, optional Wi-Fi station counters for the main chart,
and a separate local Netify socket connection for labels. Adds **Status → Offload Observer**
and an optional tab for the modern luci-mod-dashboard widget API.

This is a prototype; the latest collector changes require router validation.
It is not an official OpenWrt package. Your supplied samples establish that hardware
traffic counters reach conntrack on your build.

The bundle does not change firewall rules, offload settings, AppFlow files,
Netify configuration, network interfaces, or routing. It does not read PPE
debugfs or reset conntrack counters. Runtime data is held in RAM.

## 1. Copy and install

For a new installation, download offload-observer-0.2.4.tar.gz and copy it to the
router's /tmp directory with SCP/SFTP. Some SCP clients need the -O switch
for OpenWrt's legacy SCP protocol.

On the router:

    apk update
    apk add ucode ucode-mod-fs ucode-mod-uci ucode-mod-ubus ucode-mod-uloop ucode-mod-socket
    cd /tmp
    tar -xzf offload-observer-0.2.4.tar.gz
    cd offload-observer
    sh install.sh

The installer checks dependencies and file collisions, copies an explicit
manifest, and compiles the daemon on the router. **It does not start or
enable the service.** Existing observer configuration is preserved.

Your already installed netifyd must be running. AppFlow may remain running
for comparison; the companion does not depend on its restricted flow API.

## 2. Check scope and start

The included configuration selects **192.168.19.0/24**, matching your
supplied client. Edit /etc/config/offload_observer if your intended LAN differs.
Add every guest LAN and actual delegated IPv6 client prefix to include:

    config observer 'main'
        list subnet '192.168.19.0/24'
        option interval '5'
        option flow_max '4096'
        option group_max '512'
        option socket_path '/var/run/netifyd/netifyd.sock'
        option country_db '/usr/share/offload-observer/country.mmdb'

The optional uplink_wifi option selects an entire station-mode Wi-Fi uplink for
the main chart. It includes all link traffic, including router traffic and other
clients. See WIFI-UPLINK-UPDATE.md. It requires iw and does not replace the
separate conntrack-based breakdowns. Without this option the main chart continues
to use conntrack; this preserves existing configuration rather than auto-selecting
an uplink.

No example IPv6 prefix is preconfigured. IPv6 clients are omitted from breakdowns until
their actual prefix is added with another list subnet entry.
Traffic between two included LAN prefixes is excluded. Traffic from an
included LAN to an upstream private network is included and gets country
Local/private. Router-owned addresses learned from network.interface dump
are excluded. Optional list exclude_ip entries exclude additional addresses.

Start:

    /etc/init.d/offload-observer start
    ubus call offload_observer status
    ubus call offload_observer summary

Refresh LuCI and open **Status → Offload Observer**. Sign out and back in
if the menu is cached. The first sample establishes a baseline; subsequent
observed deltas are counted. The page refreshes every five seconds.

## 3. Enable local country lookup

    apk add libmaxminddb

OpenWrt's libmaxminddb package includes /usr/bin/mmdblookup.
Download the **MMDB** version of
[DB-IP Country Lite](https://db-ip.com/db/download/ip-to-country-lite),
accept its license, decompress the .gz file, and copy the resulting file to:

    /usr/share/offload-observer/country.mmdb

Alternatively use a compatible GeoLite2 Country MMDB under its own license.
Check available storage before copying: database sizes vary by release and
the decompressed file is larger. For attached storage, change country_db.

    mmdblookup --file /usr/share/offload-observer/country.mmdb --ip 1.1.1.1 country iso_code
    /etc/init.d/offload-observer restart

Countries are ISO country codes. The UI supplies DB-IP Lite's required
attribution link. No database is bundled, no online IP lookup API is used,
and no automatic downloads occur. At most two uncached country lookups run
per sample; early bytes can remain under Unknown.

## 4. Add the dashboard tab

After the standalone page works:

    cd /tmp/offload-observer
    sh install.sh dashboard

This checks for the modern named-widget API before copying a new include.
It never replaces existing dashboard source. Refresh the dashboard and
select **Traffic usage** in its layout settings if you use a saved layout.
If the compatibility check fails, use the standalone Status page. Older
dashboard APIs need a separate adapter.

## Scope and limits

- Observed routed TCP/UDP upload/download deltas and rates, grouped
  separately by client, application, and remote country.
- Breakdown accounting uses conntrack. Optional Wi-Fi uplink totals are kept
  separate. Netify byte counts are never added.
- Original and reply tuples match labels across NAT. Supports IPv4,
  configured IPv6 prefixes, inbound connections and DNAT.
- Native Netify application names are used when a matching tuple is known.
  Optional explicit hostname rules fill gaps.
- No per-client application/country drill-down in this release.

This version samples /proc/net/nf_conntrack; it does not subscribe to
conntrack destroy events. **It can miss connections that start and finish
between samples and bytes after the last sample of a connection.** These
are observed totals, not billing-quality accounting. Every newly visible
connection establishes a baseline without importing lifetime traffic. This
also applies when a connection reappears after being absent from a scan:
first-sighting bytes and traffic across such gaps are omitted. Rates reflect
the timing of counter updates, so delayed hardware counter synchronization
can still produce bursts. No rate ceiling is imposed. All totals reset on
observer restart.

Production accounting should use netlink dumps plus destroy events,
connection IDs, and resynchronization after event loss. Application labels
still require initial packets to be visible. A collector cannot recover
labels Netify never obtained.

Hardware offload stays enabled; no delay is deliberately added before
offloading. Some applications may remain Unknown. Start new connections
after starting the observer when testing labels: Netify does not replay
all established identities. Generic protocol-only detections such as TLS
are kept Unknown as applications. Application coverage is shown as a
percentage of observed bytes.

Late labels affect future deltas only. Early Unknown bytes are not
retroactively moved. Matched identities are retained while their conntrack
flow is observed even after Netify stops reporting it. Tuple reuse between
samples and overlapping conntrack zones cannot always be disambiguated
from Netify's tuple-only identity. A single-zone home network is the
intended trial environment.

Avoid another collector that **resets** conntrack accounting during this
trial. Some nlbwmon collection paths do this. Detected counter decreases
are rebaselined and reported, but a reset followed by growth above the
previous value can be invisible and undercount. AppFlow does not reset
these counters.

Default bounds: 4,096 selected flows, 65,536 scanned lines, 8,192 label
aliases, 8,192 Netify identities, 4,096 cached countries, and 512 aggregates
per client/application table. Oversized scans are skipped with a visible
error. Extra aggregates are grouped under Other (table limit). The UI
shows the top 100 rows in each breakdown.

Router CPU graphs improved after the collector changes, but per-version CPU
cost and the final Wi-Fi-source build still need native validation. Only ucode
is needed on the router; no Python or Node runtime is installed.

## Optional hostname rules

Append to /etc/config/offload_observer, then restart:

    config hostmap
        option suffix 'example.com'
        option name 'Example service (hostname)'

Matches example.com and its subdomains, not example.com.attacker.test.
Native Netify application names take precedence. This is hostname
recognition; ECH and shared CDN names can prevent it.

## Validate before enabling at boot

1. Keep hardware offload enabled. Start a sustained client transfer after
   the observer starts.
2. Check nonzero hw_flows and increasing totals in the summary.
3. Compare a complete interval against client transfer/interface counters,
   allowing for timing and protocol overhead. Do not assume a percentage
   accuracy without measuring it.
4. Check application coverage, countries, read_error, counter resets,
   memory and CPU:

    ubus call offload_observer summary
    logread -e offload-observer
    top

After validation:

    /etc/init.d/offload-observer enable

## Rollback

See [uninstall notes](docs/UNINSTALL.md) for cleanup and optional APK removal.

    cd /tmp/offload-observer
    sh install.sh remove

Stops/disables the observer and removes its listed files and optional
dashboard include. Configuration and country database are preserved.
Keep this bundle or re-extract it if a reboot clears /tmp.

## SDK build and local checks

The included OpenWrt SDK Makefile builds an architecture-independent
luci-app-offload-observer package. **No signed APK has been built here.**
Copy this directory to package/luci-app-offload-observer in a matching SDK:

    make package/luci-app-offload-observer/compile V=s

The SDK package includes the standalone page. The dashboard include is
separate because compatibility must first be checked.

Local verification executes the actual ucode core on the official ucode
WebAssembly VM. Native OpenWrt adapters are mocked for daemon smoke tests.
The updated UI is tested in a real local browser. No live router integration
test is claimed.

For repository development, see [DEVELOPMENT.md](DEVELOPMENT.md). Build outputs,
runtime downloads and browser screenshots stay outside version control.

    node tests/run-core.cjs /path/to/ucode.js /path/to/ucode.wasm
    node tests/daemon-smoke.cjs /path/to/ucode.js /path/to/ucode.wasm
    node tests/run-uplink.cjs /path/to/ucode.js /path/to/ucode.wasm
    node tests/frontend.cjs /path/to/playwright /optional/path/to/browser

References:

- [Linux accounting](https://docs.kernel.org/networking/nf_flowtable.html)
- [AppFlow / Netify event contract](https://github.com/VolanticSystems/luci-app-appflow)
- [Dashboard extension API](https://github.com/openwrt/luci/tree/openwrt-25.12/modules/luci-mod-dashboard)
- [Official ucode test interpreter](https://try.ucode-lang.org/)
- [OpenWrt libmaxminddb](https://github.com/openwrt/packages/tree/master/libs/libmaxminddb)
