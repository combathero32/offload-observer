// SPDX-License-Identifier: MIT
// Read-only conntrack sampling. All totals are observed deltas, not billing totals.
// Address values are immutable. Bounded caches avoid reparsing stable flows.
let address_cache = {}, key_cache = {}, network_cache = {};
let parse_address;
export function ip_bytes(ip) {
    if (type(ip) != 'string') return null;
    if (address_cache[ip]) return address_cache[ip];
    let bytes = parse_address(ip);
    if (bytes) {
        if (length(address_cache) >= 4096) address_cache = {};
        address_cache[ip] = bytes;
    }
    return bytes;
};

parse_address = function(ip) {
    if (type(ip) != 'string') return null;
    if (index(ip, ':') < 0) {
        let parts = split(ip, '.');
        if (length(parts) != 4) return null;
        let out = [];
        for (let p in parts) {
            if (!match(p, /^[0-9]{1,3}$/) || int(p) > 255) return null;
            push(out, int(p));
        }
        return out;
    }
    ip = lc(ip);
    if (index(ip, '.') >= 0) {
        let last = rindex(ip, ':');
        let v4 = ip_bytes(substr(ip, last + 1));
        if (!v4) return null;
        ip = substr(ip, 0, last + 1) + sprintf('%x:%x', v4[0]*256+v4[1], v4[2]*256+v4[3]);
    }
    if (!match(ip, /^[0-9a-f:]+$/)) return null;
    let halves = split(ip, '::');
    if (length(halves) > 2) return null;
    let left = length(halves[0]) ? split(halves[0], ':') : [];
    let right = length(halves) == 2 && length(halves[1]) ? split(halves[1], ':') : [];
    let n = length(left) + length(right);
    if ((length(halves) == 1 && n != 8) || (length(halves) == 2 && n >= 8)) return null;
    let words = [];
    for (let p in left) push(words, p);
    if (length(halves) == 2) for (let i = n; i < 8; i++) push(words, '0');
    for (let p in right) push(words, p);
    let out = [];
    for (let p in words) {
        if (!match(p, /^[0-9a-f]{1,4}$/)) return null;
        let v = int(p, 16);
        push(out, int(v / 256), v % 256);
    }
    return out;
};

export function ip_key(ip) {
    if (type(ip) != 'string') return null;
    if (key_cache[ip]) return key_cache[ip];
    let bytes = ip_bytes(ip);
    if (!bytes) return null;
    if (length(key_cache) >= 4096) key_cache = {};
    return key_cache[ip] = join('', map(bytes, b => sprintf('%02x', b)));
};

export function in_cidr(ip, cidr) {
    let network = network_cache[cidr];
    if (!network) {
        let parts = split(cidr, '/'), bytes = ip_bytes(parts[0]);
        if (!bytes) return false;
        network = {bytes, bits:length(parts) == 2 ? int(parts[1]) : length(bytes)*8};
        if (length(network_cache) >= 256) network_cache = {};
        network_cache[cidr] = network;
    }
    let a = ip_bytes(ip), b = network.bytes;
    if (!a || !b || length(a) != length(b)) return false;
    let bits = network.bits;
    if (bits == null || bits < 0 || bits > length(a)*8) return false;
    for (let i = 0; bits > 0; i++, bits -= 8) {
        let keep = bits >= 8 ? 8 : bits;
        let shift = 8 - keep;
        if ((a[i] >> shift) != (b[i] >> shift)) return false;
    }
    return true;
};

export function in_networks(ip, networks) {
    for (let cidr in networks) if (in_cidr(ip, cidr)) return true;
    return false;
};

export function tuple_key(proto, src, sport, dst, dport) {
    let a = ip_key(src), b = ip_key(dst);
    if (!a || !b || sport == null || dport == null) return null;
    return proto + '|' + a + '|' + sport + '|' + b + '|' + dport;
};

export function parse_ct(line) {
    let h = match(line, /^(ipv4|ipv6)[[:space:]]+[0-9]+[[:space:]]+(tcp|udp)[[:space:]]/);
    if (!h) return null;
    let fields = {src:[], dst:[], sport:[], dport:[], bytes:[], packets:[], zone:[]};
    for (let token in split(trim(line), /[[:space:]]+/)) {
        let kv = split(token, '=');
        if (length(kv) == 2 && fields[kv[0]] != null) push(fields[kv[0]], kv[1]);
    }
    for (let name in ['src','dst','sport','dport','bytes','packets'])
        if (length(fields[name]) != 2) return null;
    for (let name in ['sport','dport','bytes','packets']) {
        for (let i = 0; i < 2; i++) {
            if (!match(fields[name][i], /^[0-9]+$/)) return null;
            fields[name][i] = int(fields[name][i]);
        }
    }
    let orig = tuple_key(h[2], fields.src[0], fields.sport[0], fields.dst[0], fields.dport[0]);
    let reply = tuple_key(h[2], fields.src[1], fields.sport[1], fields.dst[1], fields.dport[1]);
    if (!orig || !reply) return null;
    let zone = join(',', fields.zone);
    return {
        key: zone + '|' + orig + '|' + reply, orig, reply, zone,
        aliases: [orig, reply,
            tuple_key(h[2], fields.dst[0], fields.dport[0], fields.src[0], fields.sport[0]),
            tuple_key(h[2], fields.dst[1], fields.dport[1], fields.src[1], fields.sport[1])],
        src: fields.src[0], dst: fields.dst[0], reply_src: fields.src[1], reply_dst: fields.dst[1],
        sent: fields.bytes[0], received: fields.bytes[1],
        hw: index(line, '[HW_OFFLOAD]') >= 0,
        sw: index(line, '[OFFLOAD]') >= 0
    };
};

export function direction(ct, networks, router_ips) {
    let src = in_networks(ct.src, networks) || in_networks(ct.reply_dst, networks);
    let dst = in_networks(ct.dst, networks) || in_networks(ct.reply_src, networks);
    if (src == dst) return null; // Exclude LAN-to-LAN and traffic outside the chosen LANs.
    let client = src ? (in_networks(ct.src, networks) ? ct.src : ct.reply_dst) :
        (in_networks(ct.dst, networks) ? ct.dst : ct.reply_src);
    if (router_ips[ip_key(client)]) return null;
    return { client, remote: src ? ct.dst : ct.src,
        up: src ? ct.sent : ct.received, down: src ? ct.received : ct.sent };
};

export function new_state() {
    return {warm:false, previous:{}, clients:{}, applications:{}, countries:{},
        total:{up:0,down:0}, rates:{up:0,down:0}, scans:0, active:0, hw:0,
        tracked:0, skipped_limit:0, counter_resets:0, malformed:0, generation:0,
        flows_baselined:0, last_flows_baselined:0, missing_flows:0,
        largest_baseline:null, largest_counted_delta:null,
        sample_delta:{up:0,down:0}, sample_elapsed_seconds:0};
};

function add_group(table, name, up, down, cap) {
    name = substr(name ?? 'Unknown', 0, 128);
    if (!table[name] && length(table) >= cap) name = 'Other (table limit)';
    if (!table[name]) table[name] = {name, up:0, down:0, up_bps:0, down_bps:0};
    table[name].up += up; table[name].down += down;
    table[name].up_bps += up; table[name].down_bps += down;
};

export function sample(state, records, cfg, labels, countries, elapsed, generation, directions) {
    let next = {}, touched_labels = {}, delta = {up:0,down:0};
    state.active = 0; state.hw = 0; state.last_flows_baselined = 0;
    for (let table in [state.clients, state.applications, state.countries])
        for (let k in table) { table[k].up_bps = 0; table[k].down_bps = 0; }
    // After a netfilter accounting consumer resets counters, only a new baseline is safe.
    let baseline = !state.warm || generation != state.generation;
    for (let ct in records) {
        let dir = directions != null ? directions[ct.key] : direction(ct, cfg.networks, cfg.router_ips);
        if (!dir) continue;
        state.active++; if (ct.hw) state.hw++;
        if (next[ct.key]) continue;
        if (length(next) >= cfg.flow_max) { state.skipped_limit++; continue; }
        let old = state.previous[ct.key];
        let app = old?.app ?? 'Unknown';
        let best = null;
        for (let alias in ct.aliases) {
            let label = labels[alias];
            if (label && (!best || label.rank > best.rank || (label.rank == best.rank && label.at > best.at))) best = label;
            if (label) touched_labels[alias] = true;
        }
        if (best) app = best.name;
        let up = 0, down = 0;
        if (baseline || !old) {
            // A snapshot cannot establish the connection's creation time.
            // Never import lifetime counters on first sighting or reappearance.
            state.flows_baselined++; state.last_flows_baselined++;
            let largest = state.largest_baseline;
            if (!largest || dir.up+dir.down > largest.up+largest.down)
                state.largest_baseline = {client:dir.client,remote:dir.remote,
                    up:dir.up,down:dir.down,hw:ct.hw,scan:state.scans+1};
        } else {
            if (dir.up >= old.up && dir.down >= old.down) {
                up = dir.up-old.up; down = dir.down-old.down;
            } else state.counter_resets++;
        }
        next[ct.key] = {up:dir.up, down:dir.down, app};
        if (up + down == 0) continue;
        let largest = state.largest_counted_delta;
        if (!largest || up+down > largest.up+largest.down)
            state.largest_counted_delta = {client:dir.client,remote:dir.remote,
                up,down,previous_up:old.up,previous_down:old.down,
                current_up:dir.up,current_down:dir.down,
                elapsed_seconds:elapsed,hw:ct.hw,scan:state.scans+1};
        let country = countries[ip_key(dir.remote)] ?? 'Unknown';
        add_group(state.clients, dir.client, up, down, cfg.group_max);
        add_group(state.applications, app, up, down, cfg.group_max);
        add_group(state.countries, country, up, down, 256);
        delta.up += up; delta.down += down;
    }
    state.total.up += delta.up; state.total.down += delta.down;
    let seconds = elapsed > 0 ? elapsed * 1.0 : 1.0;
    state.sample_delta = delta; state.sample_elapsed_seconds = seconds;
    state.rates = {up:delta.up/seconds, down:delta.down/seconds};
    for (let table in [state.clients, state.applications, state.countries])
        for (let k in table) { table[k].up_bps /= seconds; table[k].down_bps /= seconds; }
    state.missing_flows = 0;
    for (let key in state.previous) if (!next[key]) state.missing_flows++;
    state.previous = next; state.tracked = length(next);
    state.warm = true; state.generation = generation; state.scans++;
    return touched_labels;
};

export function label_event(ev, names, hostmaps, now, identities) {
    if (ev.type == 'definitions') {
        for (let item in (ev.applications ?? [])) if (item.id != null && length(names) < 8192) names['a'+item.id] = substr(item.tag ?? item.name ?? '',0,128);
        return [];
    }
    let incoming = ev.flow;
    if (type(incoming) != 'object') return [];
    let f = incoming;
    if (incoming.digest && identities) {
        f = identities[incoming.digest] ?? {};
        if (incoming.detected_application != null && incoming.detected_application != f.detected_application)
            delete f.detected_application_name;
        for (let k in ['local_ip','other_ip','local_port','other_port','ip_protocol','detected_application','detected_application_name','host_server_name'])
            if (incoming[k] != null) f[k] = incoming[k];
        f.at = now;
        if (length(identities) < 8192 || identities[incoming.digest]) identities[incoming.digest] = f;
    }
    if (f.local_port == null || f.other_port == null) return [];
    let proto = f.ip_protocol == 6 || lc(''+f.ip_protocol) == 'tcp' ? 'tcp' :
        (f.ip_protocol == 17 || lc(''+f.ip_protocol) == 'udp' ? 'udp' : null);
    if (!proto) return [];
    let a = tuple_key(proto, f.local_ip, f.local_port, f.other_ip, f.other_port);
    let b = tuple_key(proto, f.other_ip, f.other_port, f.local_ip, f.local_port);
    if (!a || !b) return [];
    let name = int(f.detected_application ?? 0) > 0 ? (f.detected_application_name ?? names['a'+f.detected_application]) : null;
    let rank = name ? 2 : 0;
    let host = lc(f.host_server_name ?? '');
    if (!name) for (let m in hostmaps) {
        let suffix = lc(m.suffix ?? '');
        if (length(suffix) && (host == suffix || (length(host) > length(suffix) && substr(host,length(host)-length(suffix)-1) == '.'+suffix))) {
            name = m.name; rank = 1; break;
        }
    }
    if (!length(name ?? '')) return [];
    let label = {name:substr(name,0,128), rank, at:now};
    return [{key:a,label}, {key:b,label}];
};
