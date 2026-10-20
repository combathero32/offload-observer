// Optional Wi-Fi uplink station counter source.
export function parse_station(text) {
    if (type(text) != 'string') return null;
    let stations = [], row = null;
    for (let line in split(text,'\n')) {
        let m = match(line,/^Station ([0-9a-fA-F:]{17})[[:space:]]/);
        if (m) { row = {peer:lc(m[1])}; push(stations,row); continue; }
        if (!row) continue;
        m = match(line,/^[[:space:]]*(rx bytes|tx bytes|connected time):[[:space:]]*([0-9]+)([[:space:]]|$)/);
        if (m) row[m[1] == 'rx bytes' ? 'down' : (m[1] == 'tx bytes' ? 'up' : 'connected')] = int(m[2]);
    }
    // A station-mode uplink has one peer. Never silently sum AP client traffic.
    if (length(stations) != 1) return null;
    row = stations[0];
    if (row.up == null || row.down == null || row.up < 0 || row.down < 0) return null;
    return row;
};

export function new_uplink() {
    return {previous:null,total:{up:0,down:0},rates:{up:null,down:null},
        delta:{up:0,down:0},valid:false,error:null,last_at:null,
        elapsed:0,resets:0,samples:0};
};

export function sample_uplink(state, row, now) {
    let old = state.previous;
    state.valid = false; state.rates = {up:null,down:null}; state.delta = {up:0,down:0};
    if (!row) {
        state.error = 'Wi-Fi station counters unavailable';
        state.previous = null; return;
    }
    state.error = null; state.samples++; state.last_at = now;
    state.previous = {...row,at:now}; state.elapsed = old ? now-old.at : 0;
    if (!old) return;
    if (row.peer != old.peer || row.up < old.up || row.down < old.down ||
        (row.connected != null && old.connected != null && row.connected < old.connected)) {
        state.resets++; return;
    }
    if (state.elapsed <= 0) return;
    state.delta = {up:row.up-old.up,down:row.down-old.down};
    state.total.up += state.delta.up; state.total.down += state.delta.down;
    state.rates = {up:state.delta.up/state.elapsed,down:state.delta.down/state.elapsed};
    state.valid = true;
};
