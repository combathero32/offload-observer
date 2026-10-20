'use strict';
'require baseclass';

const SVG_NS='http://www.w3.org/2000/svg';
const COLORS=['#4e9bea','#65b65d','#ad71d2','#dfac45','#e18053','#53b8be','#8492a3'];
function bytes(value) {
    let n=Math.max(0,Number(value)||0),i=0;
    const units=['B','KiB','MiB','GiB','TiB'];
    while(n>=1024 && i<units.length-1){n/=1024;i++;}
    return n.toFixed(i?2:0)+' '+units[i];
}
function rate(n){
    let value=Math.max(0,Number(n)||0)*8,i=0;
    const units=['bps','Kbps','Mbps','Gbps','Tbps'];
    while(value>=1000 && i<units.length-1){value/=1000;i++;}
    return value.toFixed(i?2:0)+' '+units[i];
}
function amount(row){return (Number(row.down)||0)+(Number(row.up)||0);}
function speed(row){return (Number(row.down_bps)||0)+(Number(row.up_bps)||0);}
function duration(seconds){
    seconds=Math.max(0,Math.floor(seconds)||0);
    return (seconds>=3600?Math.floor(seconds/3600)+'h ':'')+Math.floor(seconds%3600/60)+'m '+seconds%60+'s';
}
function setContent(node,children){
    while(node.firstChild)node.removeChild(node.firstChild);
    (Array.isArray(children)?children:[children]).forEach(child=>{
        if(child!=null)node.appendChild(typeof child==='string'?document.createTextNode(child):child);
    });
}
function svg(tag,attrs,children){
    const node=document.createElementNS(SVG_NS,tag);
    Object.keys(attrs||{}).forEach(k=>node.setAttribute(k,String(attrs[k])));
    (children||[]).forEach(child=>node.appendChild(typeof child==='string'?document.createTextNode(child):child));
    return node;
}
function pretty(name){
    const known={'github':'GitHub','office-365':'Office 365','google-play':'Google Play','xbox-live':'Xbox Live','gsuite':'Google Workspace'};
    const raw=String(name||'Unknown').replace(/^netify\./,'');
    return known[raw]||raw.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
function matches(row,query){
    const text=(String(row.name||'')+' '+String(row.label||'')+' '+pretty(row.name)).toLowerCase();
    return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term=>
        term.charAt(0)==='-' && term.length>1?!text.includes(term.slice(1)):text.includes(term));
}
function countryName(code){
    if(!/^[A-Z]{2}$/.test(code))return code;
    try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code)||code;}catch(_){return code;}
}
function badge(text,kind){return E('span',{'class':'oo-badge'+(kind?' oo-'+kind:'')},[text]);}
function panel(title,note,content){
    return E('section',{'class':'oo-panel'},[
        E('div',{'class':'oo-panel-head'},[E('h3',{},[title]),E('span',{'class':'oo-note'},[note])]),content
    ]);
}
function emptyRow(columns,message){return E('tr',{},[E('td',{'colspan':String(columns),'class':'oo-empty'},[message])]);}
function icon(text){
    let hash=0;for(const c of String(text))hash=(hash*31+c.charCodeAt(0))>>>0;
    return E('span',{'class':'oo-icon','style':'background:'+COLORS[hash%COLORS.length]},[pretty(text).charAt(0)]);
}
function bars(row,maximum){
    const down=Math.max(0,Number(row.down_bps)||0),up=Math.max(0,Number(row.up_bps)||0);
    return E('div',{'class':'oo-bar-track','aria-hidden':'true'},[
        E('span',{'class':'oo-bar-fill','style':'width:'+Math.min(100,100*(down+up)/maximum)+'%'},[
            E('span',{'class':'oo-bar-down','style':'width:'+(down+up?100*down/(down+up):0)+'%'}),
            E('span',{'class':'oo-bar-up','style':'width:'+(down+up?100*up/(down+up):0)+'%'})
        ])
    ]);
}
function search(placeholder,onChange){
    const input=E('input',{'class':'oo-search','type':'search','placeholder':placeholder,'aria-label':placeholder});
    input.addEventListener('input',()=>onChange(input.value));
    const clear=E('button',{'type':'button','class':'oo-button'},['Clear']);
    clear.addEventListener('click',()=>{input.value='';onChange('');input.focus();});
    return {input,node:E('div',{'class':'oo-search-row'},[input,clear])};
}
function heading(columns){
    return E('thead',{},[E('tr',{},columns.map((title,i)=>E('th',{'class':i?'oo-number':''},[title])))]);
}
function Controller(){
    this.data=null;this.history=[];this.appQuery='';this.clientQuery='';this.showAllApps=false;this.origin=null;
    this.badges=E('div',{'class':'oo-badges'});this.alerts=E('div',{'class':'oo-alerts','aria-live':'polite'});
    this.metrics=E('div',{'class':'oo-metrics'});this.plot=E('div',{'class':'oo-plot'});this.legend=E('div',{'class':'oo-chart-legend'});
    this.appsBody=E('tbody');this.clientsBody=E('tbody');this.countries=E('div',{'class':'oo-country-content'});
    this.appSearch=search('Filter by application or service',query=>{this.appQuery=query;this.drawApps();});
    this.clientSearch=search('Filter by device name or IP address',query=>{this.clientQuery=query;this.drawClients();});
    this.moreApps=E('button',{'type':'button','class':'oo-button oo-more'},['Show all']);
    this.moreApps.addEventListener('click',()=>{this.showAllApps=!this.showAllApps;this.drawApps();});
    this.liveTitle=E('span',{},['Live throughput']);this.scopeText=E('p',{'class':'oo-hint'});
    this.appsNote=E('span',{},['by current rate']);this.countriesNote=E('span',{},['by observed bytes']);
    this.clientsNote=E('span',{},['by observed bytes']);
    const appPanel=panel('Top applications',this.appsNote,E('div',{},[
        this.appSearch.node,E('p',{'class':'oo-hint'},['Search names, or use -name to exclude an application.']),
        E('div',{'class':'oo-table-wrap'},[E('table',{'class':'oo-table oo-app-table'},[
            heading(['Application','Traffic','Download','Upload']),this.appsBody])]),this.moreApps]));
    this.root=E('div',{'class':'oo-dashboard'},[
        E('header',{'class':'oo-panel oo-header'},[
            E('h2',{},['Offload Observer']),
            E('p',{},['Client usage, detected applications and remote countries — including hardware-offloaded traffic.'])
        ]),
        this.badges,this.alerts,
        panel(this.liveTitle,'5-minute chart · 5-second refresh',E('div',{},[this.scopeText,this.metrics,this.plot,this.legend])),
        E('div',{'class':'oo-grid'},[appPanel,panel('Remote countries',this.countriesNote,this.countries)]),
        panel('Top devices',this.clientsNote,E('div',{},[
            this.clientSearch.node,E('div',{'class':'oo-table-wrap'},[E('table',{'class':'oo-table oo-client-table'},[
                heading(['Device','Traffic','Current rate','Downloaded','Uploaded']),this.clientsBody])])
        ])),
        E('details',{'class':'oo-details'},[
            E('summary',{},['About these measurements']),
            E('p',{},['The chart scope is shown above. Totals reset when the collector restarts. Breakdown tables use sampled connection counters and can miss first-sighting bytes, short connections and final bytes. Traffic between configured LAN prefixes and router-originated traffic is excluded from those tables.']),
            E('p',{},['Application names are Netify detections or configured hostname labels. Unknown means no matching application label. Client rows represent individual IP addresses. IPv6 traffic requires its LAN prefix to be configured.']),
            E('p',{},['Countries locate remote IPs and may reflect a CDN or VPN endpoint. Previously recorded Unknown bytes are retained. The chart stores up to five minutes in this browser and starts fresh when the page opens.'])
        ]),
        E('footer',{'class':'oo-footer'},[
            E('span',{},['Blue: download · green: upload']),
            E('a',{'href':'https://db-ip.com/','target':'_blank','rel':'noopener noreferrer'},['IP Geolocation by DB-IP (when using its database)'])
        ])
    ]);
    if(!document.getElementById('offload-observer-style'))document.head.appendChild(E('link',{
        'id':'offload-observer-style','rel':'stylesheet','href':L.resource('offload_observer/observer.css')+'?v=0.2.1'
    }));
    if(typeof ResizeObserver!=='undefined'){
        this.resizeObserver=new ResizeObserver(()=>{if(this.data)this.drawChart();});
        this.resizeObserver.observe(this.plot);
    }
}
Controller.prototype.update=function(data){
    if(!data||!data.total){
        setContent(this.alerts,E('div',{'class':'oo-warning'},[
            this.data?'Collector unavailable. Showing the last received data.':'Collector unavailable. Start Offload Observer and refresh this page.'
        ]));return this.root;
    }
    this.data=data;
    const origin=String(data.started_at)+'|'+String(data.measurement?.source||'conntrack')+'|'+String(data.measurement?.interface||'');
    if(this.origin!==origin){this.history=[];this.origin=origin;}
    const timestamp=Number(data.sampled_at);
    const valid=data.measurement?.valid!==false,wifi=data.measurement?.source==='wifi_station';
    if(valid&&Number.isFinite(timestamp)&&timestamp>0){
        const point={time:timestamp,down:Math.max(0,Number(data.rates?.down)||0),up:Math.max(0,Number(data.rates?.up)||0)};
        if(!this.history.length||timestamp>this.history[this.history.length-1].time)this.history.push(point);
        else if(timestamp===this.history[this.history.length-1].time)this.history[this.history.length-1]=point;
        this.history=this.history.filter(p=>p.time>=timestamp-300).slice(-121);
    }
    const h=data.health||{},warnings=[],now=Date.now()/1000,stale=timestamp>0&&now-timestamp>20;
    setContent(this.badges,[
        badge(h.netify_connected?'● Netify connected':'● Netify disconnected',h.netify_connected?'good':'bad'),
        badge((h.hw_flows||0)+' hardware-offloaded / '+(h.active_flows||0)+' flows'),
        badge((data.applications||[]).length+' applications · '+(data.clients||[]).length+' devices'),
        badge(Number(data.application_coverage||0).toFixed(1)+'% of breakdown bytes labeled'),
        badge('Collector uptime '+duration(now-Number(data.started_at||now))),
        badge(stale?'Last sample '+duration(now-timestamp)+' ago':'Updated just now',stale?'bad':'')
    ]);
    setContent(this.liveTitle,wifi?'Wi-Fi uplink throughput':'Live throughput');
    setContent(this.scopeText,wifi?'Entire '+data.measurement.interface+' uplink, including router traffic and all clients using it.':'Routed traffic for the configured LAN prefixes.');
    setContent(this.appsNote,data.breakdowns_verified===false?'Unverified usage estimates':'by current rate');
    setContent(this.countriesNote,data.breakdowns_verified===false?'Unverified usage estimates':'by observed bytes');
    setContent(this.clientsNote,data.breakdowns_verified===false?'Unverified usage estimates':'by observed bytes');
    if(data.breakdowns_verified===false)warnings.push('Application, country and device usage estimates are unverified. They use separate connection counters and may disagree with the main chart.');
    if(!valid)warnings.push(data.measurement?.error||'Waiting for a second counter reading. Rates are unavailable.');
    if(h.read_error)warnings.push(h.read_error);
    if(stale)warnings.push('The last collector sample is stale. Rates below describe that sample.');
    if(!h.netify_connected)warnings.push('Netify is disconnected. Usage continues; new application labels are unavailable.');
    else if(!h.netify_last_event||now-h.netify_last_event>60)warnings.push('No recent Netify events. Application labels may be incomplete.');
    if(!h.country_database)warnings.push('Countries need a local country MMDB and mmdblookup.');
    else if(h.country_error)warnings.push(h.country_error);
    if(h.counter_resets)warnings.push('Counter resets detected: '+h.counter_resets+'. Affected intervals were rebaselined.');
    if(h.label_limit||h.netify_buffer_resets)warnings.push('Application label capacity was exceeded. Some traffic remains Unknown.');
    if(h.country_cache_full)warnings.push('The country cache is full. New remote IPs may remain Unknown until restart.');
    if(h.aggregate_limit)warnings.push('Some entries are grouped under Other (table limit).');
    if(h.rows_limited)warnings.push('The collector returned its top 100 rows per breakdown.');
    setContent(this.alerts,warnings.map(text=>E('div',{'class':'oo-warning'},[text])));
    const metric=(title,value,kind)=>E('div',{'class':'oo-metric'},[
        E('span',{'class':'oo-metric-title'},[title]),E('strong',{'class':kind||''},[value])]);
    setContent(this.metrics,[
        metric('Download',valid?rate(data.rates?.down):'Unavailable','oo-blue'),metric('Upload',valid?rate(data.rates?.up):'Unavailable','oo-green'),
        metric('Downloaded',bytes(data.total.down)),metric('Uploaded',bytes(data.total.up))
    ]);
    this.drawChart();this.drawApps();this.drawCountries();this.drawClients();return this.root;
};
Controller.prototype.drawChart=function(){
    const width=Math.max(280,Math.round(this.plot.clientWidth||Math.min(1000,window.innerWidth-64)));
    const height=window.innerWidth<480?155:(window.innerWidth>=1200?210:185);
    const left=64,right=12,top=14,bottom=27,innerWidth=width-left-right,innerHeight=height-top-bottom;
    const end=this.history.length?this.history[this.history.length-1].time:Date.now()/1000,start=end-300;
    const maximum=Math.max(1024,...this.history.map(p=>Math.max(p.down,p.up)))*1.12;
    const x=t=>left+(t-start)/300*innerWidth,y=n=>top+innerHeight*(1-n/maximum),children=[];
    for(let i=0;i<=4;i++){
        const value=maximum*i/4,yy=y(value);
        children.push(svg('line',{x1:left,x2:width-right,y1:yy,y2:yy,'class':'oo-gridline'}));
        children.push(svg('text',{x:left-9,y:yy+4,'text-anchor':'end','class':'oo-axis'},[value?rate(value):'0']));
    }
    for(const entry of [{key:'down',kind:'download'},{key:'up',kind:'upload'}]){
        let segment=[];
        const draw=()=>{
            if(!segment.length)return;
            const points=segment.map(p=>x(p.time).toFixed(2)+','+y(p[entry.key]).toFixed(2)).join(' ');
            const first=segment[0],last=segment[segment.length-1];
            if(segment.length>1){
                children.push(svg('polygon',{points:x(first.time)+','+y(0)+' '+points+' '+x(last.time)+','+y(0),'class':'oo-area oo-'+entry.kind}));
                children.push(svg('polyline',{points,'class':'oo-line oo-'+entry.kind}));
            }else children.push(svg('circle',{cx:x(first.time),cy:y(first[entry.key]),r:2.5,'class':'oo-dot oo-'+entry.kind}));
            segment=[];
        };
        this.history.forEach(p=>{if(segment.length&&p.time-segment[segment.length-1].time>15)draw();segment.push(p);});draw();
    }
    children.push(svg('text',{x:left,y:height-5,'class':'oo-axis'},['5 min ago']));
    children.push(svg('text',{x:width-right,y:height-5,'text-anchor':'end','class':'oo-axis'},['latest sample']));
    if(!this.history.length)children.push(svg('text',{x:width/2,y:height/2,'text-anchor':'middle','class':'oo-axis'},['Waiting for traffic samples']));
    setContent(this.plot,svg('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'Observed download and upload rates over the last five minutes'},children));
    const valid=this.data.measurement?.valid!==false;
    setContent(this.legend,[E('span',{'class':'oo-blue'},['■ Download '+(valid?rate(this.data.rates?.down):'Unavailable')]),E('span',{'class':'oo-green'},['■ Upload '+(valid?rate(this.data.rates?.up):'Unavailable')])]);
};
Controller.prototype.drawApps=function(){
    const all=(this.data?.applications||[]).filter(row=>matches(row,this.appQuery)).slice().sort((a,b)=>speed(b)-speed(a)||amount(b)-amount(a));
    const maximum=Math.max(1,...all.map(speed)),rows=this.showAllApps?all:all.slice(0,8);
    const output=rows.map(row=>E('tr',{},[
        E('td',{},[E('div',{'class':'oo-identity'},[icon(row.name),E('div',{},[
            E('span',{'class':'oo-name','title':String(row.name||'')},[pretty(row.name)]),
            E('small',{},[row.name==='Unknown'?'No matching label':'Detected application / service'])])])]),
        E('td',{'class':'oo-app-bars'},[bars(row,maximum)]),
        E('td',{'class':'oo-number'},[rate(row.down_bps)]),E('td',{'class':'oo-number'},[rate(row.up_bps)])
    ]));
    setContent(this.appsBody,output.length?output:[emptyRow(4,this.appQuery?'No matching applications.':'Waiting for observed traffic.')]);
    this.moreApps.hidden=all.length<=8;
    this.moreApps.textContent=this.showAllApps?'Show fewer':'Show all '+all.length+' applications';
};
Controller.prototype.drawCountries=function(){
    const rows=(this.data.countries||[]).slice().sort((a,b)=>amount(b)-amount(a));
    const total=rows.reduce((sum,row)=>sum+amount(row),0),shown=rows.slice(0,6).map(row=>({name:row.name,bytes:amount(row)}));
    if(rows.length>6)shown.push({name:'Other countries',bytes:rows.slice(6).reduce((sum,row)=>sum+amount(row),0)});
    let offset=0;
    const circles=[svg('circle',{cx:70,cy:70,r:53,fill:'none',stroke:'#343d47','stroke-width':16})],legend=E('div',{'class':'oo-country-legend'});
    shown.forEach((row,i)=>{
        const percent=total?100*row.bytes/total:0,color=row.name==='Unknown'?'#83909d':COLORS[i%COLORS.length];
        if(percent>0)circles.push(svg('circle',{cx:70,cy:70,r:53,fill:'none',stroke:color,'stroke-width':16,pathLength:100,
            'stroke-dasharray':percent+' '+(100-percent),'stroke-dashoffset':-offset,transform:'rotate(-90 70 70)'}));
        offset+=percent;
        legend.appendChild(E('div',{'class':'oo-country-row'},[
            E('span',{'class':'oo-swatch','style':'background:'+color}),E('span',{'class':'oo-country-name','title':row.name},[countryName(row.name)]),
            E('span',{'class':'oo-number'},[percent.toFixed(1)+'%'])]));
    });
    circles.push(svg('text',{x:70,y:68,'text-anchor':'middle','class':'oo-donut-total'},[bytes(total)]));
    circles.push(svg('text',{x:70,y:84,'text-anchor':'middle','class':'oo-axis'},['TOTAL']));
    setContent(this.countries,[
        E('div',{'class':'oo-donut-layout'},[svg('svg',{viewBox:'0 0 140 140','class':'oo-donut',role:'img','aria-label':'Country distribution by observed traffic'},circles),legend]),
        E('p',{'class':'oo-hint'},[total?'Remote IP location. Unknown bytes stay visible.':'Countries will appear as traffic is observed.'])
    ]);
};
Controller.prototype.drawClients=function(){
    const rows=(this.data?.clients||[]).filter(row=>matches(row,this.clientQuery)).slice().sort((a,b)=>amount(b)-amount(a)),maximum=Math.max(1,...rows.map(speed));
    setContent(this.clientsBody,rows.length?rows.map(row=>E('tr',{},[
        E('td',{},[E('div',{'class':'oo-identity'},[icon(row.label||row.name),E('div',{},[
            E('span',{'class':'oo-name'},[row.label||row.name]),E('small',{},[row.label!==row.name?row.name:'Client IP address'])])])]),
        E('td',{'class':'oo-device-bars'},[bars(row,maximum)]),E('td',{'class':'oo-number'},[rate(speed(row))]),
        E('td',{'class':'oo-number'},[bytes(row.down)]),E('td',{'class':'oo-number'},[bytes(row.up)])
    ])):[emptyRow(5,this.clientQuery?'No matching devices.':'Waiting for observed client traffic.')]);
};
return baseclass.extend({create(){return new Controller();},render(data){return new Controller().update(data);}});
